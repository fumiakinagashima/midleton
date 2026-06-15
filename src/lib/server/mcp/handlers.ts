import { and, eq, like, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db';
import {
	customers,
	contacts,
	deals,
	activities,
	entityTypes,
	entityFields,
	entities,
	integrations
} from '../db/schema';
import {
	listApprovals,
	getApproval,
	createApproval,
	updateApprovalStep,
	cancelApproval
} from '../db/approval-service';
import { dealRegisteredActivityInsert, recordActivity, createEntityType, createRecord } from '../db/table-service';
import { createNotification } from '../db/notification-service';
import { createReminder, resolveChannelLabels } from '../db/reminder-service';
import { sendEmail, getEmailSetup, type EmailEnv } from '../email';
import { computeCustomerHealthScore, getCachedCustomerHealthScore } from '../ai/customer-health';
import { computeCustomerHandoverSummary } from '../ai/customer-handover';
import {
	generateWordDocument,
	generateExcelWorkbook,
	generatePowerpointPresentation,
	saveGeneratedDocument,
	type WordBlock
} from '../documents';
import type { LinkContent, DocumentJobContent } from '$lib/types/chat';
import { parseJstDatetime } from '$lib/datetime';

export type ToolEnv = EmailEnv & {
	ANTHROPIC_API_KEY?: string;
	R2?: R2Bucket;
	KV?: KVNamespace;
	accountId?: string;
	accountName?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJson(s: string | null | undefined): Record<string, unknown> {
	try {
		return JSON.parse(s ?? '{}') ?? {};
	} catch {
		return {};
	}
}

function mergeCustom(existing: string | null | undefined, incoming: unknown): string {
	const base = parseJson(existing);
	const patch = (incoming && typeof incoming === 'object' && !Array.isArray(incoming))
		? (incoming as Record<string, unknown>)
		: {};
	return JSON.stringify({ ...base, ...patch });
}

function now(): Date {
	return new Date();
}

// ── External API integrations ──────────────────────────────────────────────

async function handleListIntegrations(db: Db) {
	const rows = await db
		.select({
			id: integrations.id,
			name: integrations.name,
			description: integrations.description,
			baseUrl: integrations.baseUrl,
			authType: integrations.authType,
			createdAt: integrations.createdAt
		})
		.from(integrations)
		.orderBy(integrations.name);
	return rows;
}

const callExternalApiSchema = z.object({
	integration_id: z.string(),
	endpoint: z.string(),
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
	body: z.record(z.string(), z.unknown()).optional(),
	query: z.record(z.string(), z.unknown()).optional(),
	headers: z.record(z.string(), z.string()).optional()
});

async function handleCallExternalApi(db: Db, input: unknown) {
	const p = callExternalApiSchema.parse(input);

	const [integration] = await db
		.select()
		.from(integrations)
		.where(eq(integrations.id, p.integration_id));
	if (!integration) throw new Error(`連携が見つかりません: ${p.integration_id}`);

	const authConfig = parseJson(integration.authConfig);

	const base = integration.baseUrl.replace(/\/$/, '');
	let path: string;
	if (!p.endpoint || p.endpoint === '/') {
		path = base;
	} else if (p.endpoint.startsWith('http')) {
		if (new URL(p.endpoint).origin !== new URL(base).origin) {
			throw new Error('endpoint は連携先（baseUrl）と同じホストのURLのみ指定できます');
		}
		path = p.endpoint;
	} else {
		path = `${base}/${p.endpoint.replace(/^\//, '')}`;
	}

	let url = path;
	if (p.query && Object.keys(p.query).length > 0) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(p.query)) params.set(k, String(v));
		url += (url.includes('?') ? '&' : '?') + params.toString();
	}

	const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...p.headers };

	switch (integration.authType) {
		case 'api_key':
			reqHeaders[(authConfig.headerName as string) || 'X-API-Key'] = authConfig.value as string;
			break;
		case 'bearer':
			reqHeaders['Authorization'] = `Bearer ${authConfig.value}`;
			break;
		case 'basic': {
			const encoded = btoa(`${authConfig.username}:${authConfig.password}`);
			reqHeaders['Authorization'] = `Basic ${encoded}`;
			break;
		}
	}

	const res = await fetch(url, {
		method: p.method,
		headers: reqHeaders,
		body: p.body !== undefined ? JSON.stringify(p.body) : undefined
	});

	const ct = res.headers.get('content-type') ?? '';
	const resBody = ct.includes('application/json') ? await res.json() : await res.text();

	return { status: res.status, ok: res.ok, body: resBody };
}

// ── Search ─────────────────────────────────────────────────────────────────

const searchCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	has_deal_status: z.enum(['open', 'won', 'lost']).optional(),
	deal_since: z.string().optional(),
	deal_until: z.string().optional(),
	has_activity_type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).optional(),
	activity_since: z.string().optional(),
	activity_until: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

async function handleSearchCustomers(db: Db, input: unknown) {
	const p = searchCustomersSchema.parse(input);

	const dealSub = p.has_deal_status
		? db.selectDistinct({ id: deals.customerId }).from(deals).where(
				and(
					eq(deals.status, p.has_deal_status),
					p.deal_since ? gte(deals.createdAt, toDate(p.deal_since)) : undefined,
					p.deal_until ? lte(deals.createdAt, toDate(p.deal_until)) : undefined
				)
			)
		: null;

	const actSub = p.has_activity_type
		? db.selectDistinct({ id: activities.customerId }).from(activities).where(
				and(
					eq(activities.type, p.has_activity_type),
					p.activity_since ? gte(activities.createdAt, toDate(p.activity_since)) : undefined,
					p.activity_until ? lte(activities.createdAt, toDate(p.activity_until)) : undefined
				)
			)
		: null;

	const rows = await db
		.select()
		.from(customers)
		.where(
			and(
				p.name ? like(customers.name, `%${p.name}%`) : undefined,
				p.status ? eq(customers.status, p.status) : undefined,
				dealSub ? inArray(customers.id, dealSub) : undefined,
				actSub ? inArray(customers.id, actSub) : undefined
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchDealsSchema = z.object({
	customer_name: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	amount_min: z.number().optional(),
	amount_max: z.number().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at'),
	limit: z.number().int().positive().default(50)
});

async function handleSearchDeals(db: Db, input: unknown) {
	const p = searchDealsSchema.parse(input);
	const dateCol = p.date_field === 'closed_at' ? deals.closedAt : deals.createdAt;

	const rows = await db
		.select({
			id: deals.id,
			customerId: deals.customerId,
			customerName: customers.name,
			title: deals.title,
			amount: deals.amount,
			status: deals.status,
			closedAt: deals.closedAt,
			notes: deals.notes,
			custom: deals.custom,
			createdAt: deals.createdAt,
			updatedAt: deals.updatedAt
		})
		.from(deals)
		.leftJoin(customers, eq(deals.customerId, customers.id))
		.where(
			and(
				p.customer_name ? like(customers.name, `%${p.customer_name}%`) : undefined,
				p.status ? eq(deals.status, p.status) : undefined,
				p.amount_min !== undefined ? gte(deals.amount, p.amount_min) : undefined,
				p.amount_max !== undefined ? lte(deals.amount, p.amount_max) : undefined,
				p.since ? gte(dateCol, toDate(p.since)) : undefined,
				p.until ? lte(dateCol, toDate(p.until)) : undefined
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).optional(),
	content: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

async function handleSearchActivities(db: Db, input: unknown) {
	const p = searchActivitiesSchema.parse(input);

	const rows = await db
		.select()
		.from(activities)
		.where(
			and(
				p.customer_id ? eq(activities.customerId, p.customer_id) : undefined,
				p.type ? eq(activities.type, p.type) : undefined,
				p.content ? like(activities.content, `%${p.content}%`) : undefined,
				p.since ? gte(activities.createdAt, toDate(p.since)) : undefined,
				p.until ? lte(activities.createdAt, toDate(p.until)) : undefined
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(p.limit);

	return rows;
}

// ── Aggregations ───────────────────────────────────────────────────────────

function toDate(s: string): Date {
	const d = new Date(s);
	if (isNaN(d.getTime())) throw new Error(`無効な日付: ${s}`);
	return d;
}

const summarizeDealsSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at')
});

async function handleSummarizeDeals(db: Db, input: unknown) {
	const { customer_id, since, until, date_field } = summarizeDealsSchema.parse(input);
	const dateCol = date_field === 'closed_at' ? deals.closedAt : deals.createdAt;

	const rows = await db
		.select({
			status: deals.status,
			count: sql<number>`cast(count(*) as integer)`,
			totalAmount: sql<number>`cast(coalesce(sum(${deals.amount}), 0) as integer)`,
			avgAmount: sql<number>`cast(coalesce(avg(${deals.amount}), 0) as integer)`
		})
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				since ? gte(dateCol, toDate(since)) : undefined,
				until ? lte(dateCol, toDate(until)) : undefined
			)
		)
		.groupBy(deals.status);

	const byStatus: Record<string, { count: number; total_amount: number; avg_amount: number }> = {};
	let totalCount = 0;
	let totalAmount = 0;
	for (const r of rows) {
		byStatus[r.status] = { count: r.count, total_amount: r.totalAmount, avg_amount: r.avgAmount };
		totalCount += r.count;
		totalAmount += r.totalAmount;
	}

	return { by_status: byStatus, total: { count: totalCount, total_amount: totalAmount } };
}

const summarizeCustomersSchema = z.object({
	since: z.string().optional(),
	until: z.string().optional()
});

async function handleSummarizeCustomers(db: Db, input: unknown) {
	const { since, until } = summarizeCustomersSchema.parse(input);

	const rows = await db
		.select({
			status: customers.status,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(customers)
		.where(
			and(
				since ? gte(customers.createdAt, toDate(since)) : undefined,
				until ? lte(customers.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(customers.status);

	const byStatus: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byStatus[r.status] = r.count;
		total += r.count;
	}

	return { total, by_status: byStatus };
}

const summarizeActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional()
});

async function handleSummarizeActivities(db: Db, input: unknown) {
	const { customer_id, since, until } = summarizeActivitiesSchema.parse(input);

	const rows = await db
		.select({
			type: activities.type,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(activities)
		.where(
			and(
				customer_id ? eq(activities.customerId, customer_id) : undefined,
				since ? gte(activities.createdAt, toDate(since)) : undefined,
				until ? lte(activities.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(activities.type);

	const byType: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byType[r.type] = r.count;
		total += r.count;
	}

	return { total, by_type: byType };
}

// ── Customer detail ────────────────────────────────────────────────────────

const getCustomerDetailSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	activities_limit: z.number().int().positive().default(10)
});

async function handleGetCustomerDetail(db: Db, input: unknown) {
	const { id, name, activities_limit } = getCustomerDetailSchema.parse(input);
	if (!id && !name) throw new Error('id または name のどちらかを指定してください');

	let customer;
	if (id) {
		const [row] = await db.select().from(customers).where(eq(customers.id, id));
		if (!row) throw new Error(`顧客が見つかりません: ${id}`);
		customer = row;
	} else {
		const rows = await db
			.select()
			.from(customers)
			.where(like(customers.name, `%${name}%`))
			.limit(1);
		if (!rows[0]) throw new Error(`顧客が見つかりません: ${name}`);
		customer = rows[0];
	}

	const [customerContacts, customerDeals, customerActivities] = await Promise.all([
		db.select().from(contacts).where(eq(contacts.customerId, customer.id)).orderBy(desc(contacts.createdAt)),
		db.select().from(deals).where(eq(deals.customerId, customer.id)).orderBy(desc(deals.createdAt)),
		db
			.select()
			.from(activities)
			.where(eq(activities.customerId, customer.id))
			.orderBy(desc(activities.createdAt))
			.limit(activities_limit)
	]);

	return {
		...customer,
		custom: parseJson(customer.custom),
		contacts: customerContacts.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		deals: customerDeals.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		activities: customerActivities
	};
}

// ── Customer health score ─────────────────────────────────────────────────

const getCustomerHealthScoreSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	force: z.boolean().optional().default(false)
});

async function handleGetCustomerHealthScore(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, force } = getCustomerHealthScoreSchema.parse(input);
	if (!id && !name) throw new Error('id または name のどちらかを指定してください');

	let customer;
	if (id) {
		const [row] = await db.select().from(customers).where(eq(customers.id, id));
		if (!row) throw new Error(`顧客が見つかりません: ${id}`);
		customer = row;
	} else {
		const rows = await db
			.select()
			.from(customers)
			.where(like(customers.name, `%${name}%`))
			.limit(1);
		if (!rows[0]) throw new Error(`顧客が見つかりません: ${name}`);
		customer = rows[0];
	}

	if (!force) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			return {
				id: customer.id,
				name: customer.name,
				...cached,
				updatedAt: cached.updatedAt.toISOString(),
				cached: true
			};
		}
	}

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');

	const result = await computeCustomerHealthScore(db, customer, apiKey);
	return {
		id: customer.id,
		name: customer.name,
		...result,
		updatedAt: result.updatedAt.toISOString(),
		cached: false
	};
}

const getCustomerHealthRankingSchema = z.object({
	order: z.enum(['asc', 'desc']).optional().default('desc'),
	limit: z.number().int().positive().optional().default(5)
});

async function handleGetCustomerHealthRanking(db: Db, input: unknown) {
	const { order, limit } = getCustomerHealthRankingSchema.parse(input);
	const rows = await db.select().from(customers);

	const ranked: { id: string; name: string; score: number; level: string; summary: string; updatedAt: string }[] = [];
	const uncomputedNames: string[] = [];

	for (const customer of rows) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			ranked.push({
				id: customer.id,
				name: customer.name,
				score: cached.score,
				level: cached.level,
				summary: cached.summary,
				updatedAt: cached.updatedAt.toISOString()
			});
		} else {
			uncomputedNames.push(customer.name);
		}
	}

	ranked.sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score));

	return {
		ranking: ranked.slice(0, limit),
		uncomputedCount: uncomputedNames.length,
		uncomputedNames
	};
}

// ── Customer handover summary ───────────────────────────────────────────────

const getCustomerHandoverSummarySchema = z.object({
	id: z.string().optional(),
	name: z.string().optional()
});

async function handleGetCustomerHandoverSummary(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name } = getCustomerHandoverSummarySchema.parse(input);
	if (!id && !name) throw new Error('id または name のどちらかを指定してください');

	let customer;
	if (id) {
		const [row] = await db.select().from(customers).where(eq(customers.id, id));
		if (!row) throw new Error(`顧客が見つかりません: ${id}`);
		customer = row;
	} else {
		const rows = await db
			.select()
			.from(customers)
			.where(like(customers.name, `%${name}%`))
			.limit(1);
		if (!rows[0]) throw new Error(`顧客が見つかりません: ${name}`);
		customer = rows[0];
	}

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');

	const result = await computeCustomerHandoverSummary(db, customer, apiKey);
	return {
		id: customer.id,
		name: customer.name,
		...result
	};
}

// ── Document generation ──────────────────────────────────────────────────────

const documentTableSchema = z.object({
	columns: z.array(z.object({ key: z.string(), label: z.string() })),
	rows: z.array(z.record(z.string(), z.unknown()))
});

const wordBlockSchema = z.object({
	type: z.enum(['heading', 'paragraph', 'table']),
	level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
	text: z.string().optional(),
	columns: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
	rows: z.array(z.record(z.string(), z.unknown())).optional()
});

const createWordDocumentSchema = z.object({
	filename: z.string().min(1),
	title: z.string().optional(),
	blocks: z.array(wordBlockSchema)
});

function toWordBlocks(blocks: z.infer<typeof wordBlockSchema>[]): WordBlock[] {
	return blocks.map((b) => {
		if (b.type === 'heading') return { type: 'heading', level: b.level, text: b.text ?? '' };
		if (b.type === 'paragraph') return { type: 'paragraph', text: b.text ?? '' };
		return { type: 'table', columns: b.columns ?? [], rows: b.rows ?? [] };
	});
}

// 資料生成ジョブをKVに登録し、ctx.waitUntilでバックグラウンド実行する（ctx無しの場合は同期実行）
type DocumentJobStatus =
	| { status: 'pending' }
	| { status: 'done'; result: LinkContent }
	| { status: 'error'; error: string };

async function runDocumentJob(
	db: Db,
	env: ToolEnv,
	ctx: ExecutionContext | undefined,
	label: string,
	generate: () => Promise<LinkContent>
): Promise<DocumentJobContent> {
	if (!env.KV) throw new Error('KVが設定されていないため資料生成のジョブを管理できません');
	const kv = env.KV;
	const jobId = crypto.randomUUID();

	const put = (value: DocumentJobStatus) =>
		kv.put(`docjob:${jobId}`, JSON.stringify(value), { expirationTtl: 3600 });

	await put({ status: 'pending' });

	const finish = async () => {
		try {
			const result = await generate();
			await put({ status: 'done', result });
			await createNotification(db, {
				type: 'document_job',
				title: `「${label}」の生成が完了しました`,
				body: `「${label}」のダウンロード準備ができました。`,
				seedContent: [
					{ type: 'text', text: `資料「${label}」の生成が完了しました。` },
					{ type: 'link', label: result.label, href: result.href, description: result.description }
				],
				accountId: env.accountId
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			await put({ status: 'error', error: message });
			await createNotification(db, {
				type: 'document_job',
				title: `「${label}」の生成に失敗しました`,
				body: message,
				seedContent: [{ type: 'text', text: `資料「${label}」の生成に失敗しました: ${message}` }],
				accountId: env.accountId
			});
		}
	};

	if (ctx) {
		ctx.waitUntil(finish());
	} else {
		await finish();
	}

	return { type: 'document_job', jobId, label };
}

async function handleCreateWordDocument(db: Db, input: unknown, env?: ToolEnv, ctx?: ExecutionContext) {
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
	const r2 = env.R2;
	const { filename, title, blocks } = createWordDocumentSchema.parse(input);
	const label = `${filename}.docx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generateWordDocument({ title, blocks: toWordBlocks(blocks) });
		return saveGeneratedDocument(r2, buffer, label, 'docx');
	});
}

const createExcelWorkbookSchema = z.object({
	filename: z.string().min(1),
	sheets: z.array(
		z.object({
			name: z.string(),
			columns: z.array(z.object({ key: z.string(), label: z.string(), width: z.number().optional() })),
			rows: z.array(z.record(z.string(), z.unknown()))
		})
	)
});

async function handleCreateExcelWorkbook(db: Db, input: unknown, env?: ToolEnv, ctx?: ExecutionContext) {
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
	const r2 = env.R2;
	const { filename, sheets } = createExcelWorkbookSchema.parse(input);
	const label = `${filename}.xlsx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generateExcelWorkbook(sheets);
		return saveGeneratedDocument(r2, buffer, label, 'xlsx');
	});
}

const createPowerpointPresentationSchema = z.object({
	filename: z.string().min(1),
	title: z.string().optional(),
	slides: z.array(
		z.object({
			title: z.string().optional(),
			body: z.array(z.string()).optional(),
			table: documentTableSchema.optional()
		})
	)
});

async function handleCreatePowerpointPresentation(db: Db, input: unknown, env?: ToolEnv, ctx?: ExecutionContext) {
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
	const r2 = env.R2;
	const { filename, title, slides } = createPowerpointPresentationSchema.parse(input);
	const label = `${filename}.pptx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generatePowerpointPresentation({ title, slides });
		return saveGeneratedDocument(r2, buffer, label, 'pptx');
	});
}

// ── Customers ──────────────────────────────────────────────────────────────

const getCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	limit: z.number().int().positive().default(50)
});

const getCustomerSchema = z.object({ id: z.string() });

const createCustomerSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateCustomerSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const deleteCustomerSchema = z.object({ id: z.string() });

const createCustomerWithContactSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	contact_name: z.string().min(1),
	contact_name_kana: z.string().optional(),
	contact_role: z.string().optional(),
	contact_department: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

async function handleGetCustomers(db: Db, input: unknown) {
	const { name, status, limit } = getCustomersSchema.parse(input);
	const result = await db
		.select()
		.from(customers)
		.where(
			and(
				name ? like(customers.name, `%${name}%`) : undefined,
				status ? eq(customers.status, status) : undefined
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleGetCustomer(db: Db, input: unknown) {
	const { id } = getCustomerSchema.parse(input);
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	if (!row) throw new Error(`顧客が見つかりません: ${id}`);
	return { ...row, custom: parseJson(row.custom) };
}

async function handleCreateCustomer(db: Db, input: unknown) {
	const data = createCustomerSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(customers).values({
		id,
		name: data.name,
		email: data.email,
		phone: data.phone,
		postalCode: data.postal_code,
		address: data.address,
		website: data.website,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateCustomer(db: Db, input: unknown) {
	const data = updateCustomerSchema.parse(input);
	const [existing] = await db.select().from(customers).where(eq(customers.id, data.id));
	if (!existing) throw new Error(`顧客が見つかりません: ${data.id}`);

	await db
		.update(customers)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.postal_code !== undefined && { postalCode: data.postal_code }),
			...(data.address !== undefined && { address: data.address }),
			...(data.website !== undefined && { website: data.website }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(customers.id, data.id));

	const [row] = await db.select().from(customers).where(eq(customers.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleDeleteCustomer(db: Db, input: unknown) {
	const { id } = deleteCustomerSchema.parse(input);
	await db.delete(customers).where(eq(customers.id, id));
	return { deleted: true, id };
}

async function handleCreateCustomerWithContact(db: Db, input: unknown) {
	const data = createCustomerWithContactSchema.parse(input);

	const customerId = crypto.randomUUID();
	const contactId = crypto.randomUUID();
	await db.batch([
		db.insert(customers).values({
			id: customerId,
			name: data.name,
			email: data.email,
			phone: data.phone,
			address: data.address,
			website: data.website,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		db.insert(contacts).values({
			id: contactId,
			customerId,
			name: data.contact_name,
			nameKana: data.contact_name_kana,
			email: data.email,
			phone: data.phone,
			role: data.contact_role,
			department: data.contact_department,
			custom: JSON.stringify({})
		})
	]);

	const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
	const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
	return {
		customer: { ...customer, custom: parseJson(customer.custom) },
		contact: { ...contact, custom: parseJson(contact.custom) }
	};
}

// ── Contacts ───────────────────────────────────────────────────────────────

const getContactsSchema = z.object({
	customer_id: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

const createContactSchema = z.object({
	customer_id: z.string(),
	name: z.string().min(1),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateContactSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

async function handleGetContacts(db: Db, input: unknown) {
	const { customer_id, limit } = getContactsSchema.parse(input);
	const result = await db
		.select()
		.from(contacts)
		.where(customer_id ? eq(contacts.customerId, customer_id) : undefined)
		.orderBy(desc(contacts.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleCreateContact(db: Db, input: unknown) {
	const data = createContactSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(contacts).values({
		id,
		customerId: data.customer_id,
		name: data.name,
		nameKana: data.name_kana,
		email: data.email,
		phone: data.phone,
		role: data.role,
		department: data.department,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateContact(db: Db, input: unknown) {
	const data = updateContactSchema.parse(input);
	const [existing] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	if (!existing) throw new Error(`担当者が見つかりません: ${data.id}`);

	await db
		.update(contacts)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.name_kana !== undefined && { nameKana: data.name_kana }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.role !== undefined && { role: data.role }),
			...(data.department !== undefined && { department: data.department }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(contacts.id, data.id));

	const [row] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

// ── Deals ──────────────────────────────────────────────────────────────────

const getDealsSchema = z.object({
	customer_id: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	limit: z.number().int().positive().default(50)
});

const createDealSchema = z.object({
	customer_id: z.string(),
	title: z.string().min(1),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).default('open'),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateDealSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

async function handleGetDeals(db: Db, input: unknown) {
	const { customer_id, status, limit } = getDealsSchema.parse(input);
	const result = await db
		.select()
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				status ? eq(deals.status, status) : undefined
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

async function handleCreateDeal(db: Db, input: unknown, env?: ToolEnv) {
	const data = createDealSchema.parse(input);
	const id = crypto.randomUUID();
	await db.batch([
		db.insert(deals).values({
			id,
			customerId: data.customer_id,
			title: data.title,
			amount: data.amount,
			status: data.status,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		dealRegisteredActivityInsert(db, data.customer_id, data.title, env?.accountId)
	]);
	const [row] = await db.select().from(deals).where(eq(deals.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

async function handleUpdateDeal(db: Db, input: unknown) {
	const data = updateDealSchema.parse(input);
	const [existing] = await db.select().from(deals).where(eq(deals.id, data.id));
	if (!existing) throw new Error(`案件が見つかりません: ${data.id}`);

	const closedAt =
		data.status === 'won' || data.status === 'lost'
			? now()
			: data.status === 'open'
				? null
				: undefined;

	await db
		.update(deals)
		.set({
			...(data.title !== undefined && { title: data.title }),
			...(data.amount !== undefined && { amount: data.amount }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			...(closedAt !== undefined && { closedAt }),
			updatedAt: now()
		})
		.where(eq(deals.id, data.id));

	const [row] = await db.select().from(deals).where(eq(deals.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

// ── Activities ─────────────────────────────────────────────────────────────

const getActivitiesSchema = z.object({
	customer_id: z.string(),
	limit: z.number().int().positive().default(20)
});

const createActivitySchema = z.object({
	customer_id: z.string(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).default('note'),
	content: z.string().min(1)
});

async function handleGetActivities(db: Db, input: unknown) {
	const { customer_id, limit } = getActivitiesSchema.parse(input);
	return db
		.select()
		.from(activities)
		.where(eq(activities.customerId, customer_id))
		.orderBy(desc(activities.createdAt))
		.limit(limit);
}

async function handleCreateActivity(db: Db, input: unknown, env?: ToolEnv) {
	const data = createActivitySchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(activities).values({
		id,
		customerId: data.customer_id,
		type: data.type,
		content: data.content,
		createdBy: env?.accountId ?? ''
	});
	const [row] = await db.select().from(activities).where(eq(activities.id, id));
	return row;
}

const sendEmailSchema = z.object({
	to: z.string().email(),
	subject: z.string().min(1),
	body: z.string().min(1),
	customer_id: z.string().optional()
});

async function handleSendEmail(db: Db, input: unknown, env?: ToolEnv) {
	const data = sendEmailSchema.parse(input);
	const setup = await getEmailSetup(db, env);
	if (!setup) {
		throw new Error('メール送信が設定されていません（/settings/email、または EMAIL_PROVIDER / EMAIL_FROM などの環境変数を設定してください）');
	}
	const body = setup.signature ? `${data.body}\n\n${setup.signature}` : data.body;
	await sendEmail(setup.providerConfig, {
		from: setup.from,
		fromName: setup.fromName,
		to: data.to,
		subject: data.subject,
		text: body
	});
	if (data.customer_id) {
		await recordActivity(db, data.customer_id, 'email', `メール「${data.subject}」を送信しました`, env?.accountId);
	}
	return { to: data.to, subject: data.subject };
}

// ── Reminders ────────────────────────────────────────────────────────────

const createReminderSchema = z.object({
	remind_at: z.string().min(1),
	content: z.string().min(1),
	channels: z.string().min(1)
});

async function handleCreateReminder(db: Db, input: unknown, env?: ToolEnv) {
	const data = createReminderSchema.parse(input);
	const channels = data.channels.split(',').map((c) => c.trim()).filter(Boolean);
	const reminder = await createReminder(db, {
		remindAt: parseJstDatetime(data.remind_at),
		content: data.content,
		channels,
		accountId: env?.accountId ?? null
	});

	const channelLabels = await resolveChannelLabels(db, channels);

	return { ...reminder, channelLabels };
}

// ── User-defined entity types ──────────────────────────────────────────────

const createEntityTypeSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional()
});

const getEntityFieldsSchema = z.object({ entity_type_id: z.string() });

const addEntityFieldSchema = z.object({
	entity_type_id: z.string(),
	key: z.string().min(1).regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect']).default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([]),
	ref_table: z.string().optional()
});

const getEntitiesSchema = z.object({
	entity_type_id: z.string(),
	limit: z.number().int().positive().default(50)
});

const createEntitySchema = z.object({
	entity_type_id: z.string(),
	data: z.record(z.string(), z.unknown())
});

const updateEntitySchema = z.object({
	id: z.string(),
	data: z.record(z.string(), z.unknown())
});

async function handleListEntityTypes(db: Db) {
	return db.select().from(entityTypes).orderBy(entityTypes.label);
}

async function handleGetEntityFields(db: Db, input: unknown) {
	const { entity_type_id } = getEntityFieldsSchema.parse(input);
	return db
		.select()
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, entity_type_id))
		.orderBy(entityFields.sortOrder, entityFields.createdAt)
		.then((rows) => rows.map((r) => ({ ...r, options: parseJson(r.options) })));
}

const createAppFieldSchema = z.object({
	key: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	type: z.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect']).default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([]),
	ref_table: z.string().optional()
});

const createAppSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(createAppFieldSchema).min(1),
	seed_records: z.array(z.record(z.string(), z.unknown())).optional().default([])
});

async function handleCreateApp(db: Db, input: unknown) {
	const data = createAppSchema.parse(input);

	await createEntityType(db, {
		name: data.name,
		label: data.label,
		icon: data.icon,
		fields: data.fields.map((f) => ({
			_id: crypto.randomUUID(),
			key: f.key, label: f.label, type: f.type, required: f.required, options: f.options,
			refTable: f.ref_table
		}))
	});

	for (const record of data.seed_records) {
		await createRecord(db, data.name, record);
	}

	return {
		name: data.name,
		label: data.label,
		icon: data.icon,
		fieldCount: data.fields.length,
		seedCount: data.seed_records.length,
		url: `/database/${data.name}`
	};
}

async function handleCreateEntityType(db: Db, input: unknown) {
	const data = createEntityTypeSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(entityTypes).values({ id, name: data.name, label: data.label, icon: data.icon });
	const [row] = await db.select().from(entityTypes).where(eq(entityTypes.id, id));
	return row;
}

async function handleAddEntityField(db: Db, input: unknown) {
	const data = addEntityFieldSchema.parse(input);
	const [type] = await db
		.select()
		.from(entityTypes)
		.where(eq(entityTypes.id, data.entity_type_id));
	if (!type) throw new Error(`エンティティ種別が見つかりません: ${data.entity_type_id}`);

	const [maxRow] = await db
		.select({ sortOrder: entityFields.sortOrder })
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, data.entity_type_id))
		.orderBy(desc(entityFields.sortOrder))
		.limit(1);
	const sortOrder = (maxRow?.sortOrder ?? -1) + 1;

	const id = crypto.randomUUID();
	await db.insert(entityFields).values({
		id,
		entityTypeId: data.entity_type_id,
		key: data.key,
		label: data.label,
		type: data.type,
		required: data.required,
		options: JSON.stringify(data.options),
		refTable: data.ref_table ?? null,
		sortOrder
	});
	const [row] = await db.select().from(entityFields).where(eq(entityFields.id, id));
	return { ...row, options: parseJson(row.options) };
}

async function handleGetEntities(db: Db, input: unknown) {
	const { entity_type_id, limit } = getEntitiesSchema.parse(input);
	const rows = await db
		.select()
		.from(entities)
		.where(eq(entities.entityTypeId, entity_type_id))
		.orderBy(desc(entities.createdAt))
		.limit(limit);
	return rows.map((r) => ({ ...r, data: parseJson(r.data) }));
}

async function handleCreateEntity(db: Db, input: unknown) {
	const { entity_type_id, data } = createEntitySchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(entities).values({ id, entityTypeId: entity_type_id, data: JSON.stringify(data) });
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

async function handleUpdateEntity(db: Db, input: unknown) {
	const { id, data } = updateEntitySchema.parse(input);
	const [existing] = await db.select().from(entities).where(eq(entities.id, id));
	if (!existing) throw new Error(`レコードが見つかりません: ${id}`);

	const merged = JSON.stringify({ ...parseJson(existing.data), ...data });
	await db.update(entities).set({ data: merged, updatedAt: now() }).where(eq(entities.id, id));
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

// ── Approvals ─────────────────────────────────────────────────────────────

const listApprovalsSchema = z.object({
	status: z.array(z.string()).optional(),
	type: z.string().optional()
});

async function handleListApprovals(db: Db, input: unknown) {
	const p = listApprovalsSchema.parse(input ?? {});
	return listApprovals(db, { status: p.status });
}

const getApprovalSchema = z.object({ id: z.string() });

async function handleGetApproval(db: Db, input: unknown) {
	const { id } = getApprovalSchema.parse(input);
	const row = await getApproval(db, id);
	if (!row) throw new Error(`申請が見つかりません: ${id}`);
	return row;
}

const createApprovalSchema = z.object({
	title: z.string(),
	submitted_by: z.string().optional(),
	content: z.string().optional(),
	route: z.array(z.object({
		step: z.number(),
		approver: z.string(),
		email: z.string().optional(),
		role: z.string().optional()
	}))
});

async function handleCreateApproval(db: Db, input: unknown, env?: ToolEnv) {
	const p = createApprovalSchema.parse(input);
	return createApproval(db, {
		title: p.title,
		submittedBy: p.submitted_by ?? env?.accountName ?? '',
		content: p.content,
		route: p.route
	});
}

const updateApprovalStepSchema = z.object({
	id: z.string(),
	step: z.number(),
	action: z.enum(['approve', 'reject']),
	comment: z.string().optional()
});

async function handleUpdateApprovalStep(db: Db, input: unknown, env?: ToolEnv) {
	const p = updateApprovalStepSchema.parse(input);
	return updateApprovalStep(db, p.id, p.step, p.action, env?.accountId, p.comment);
}

const cancelApprovalSchema = z.object({ id: z.string() });

async function handleCancelApproval(db: Db, input: unknown) {
	const { id } = cancelApprovalSchema.parse(input);
	return cancelApproval(db, id);
}

// ── Dispatch ───────────────────────────────────────────────────────────────

export type ToolName =
	| 'list_integrations'
	| 'call_external_api'
	| 'search_customers'
	| 'search_deals'
	| 'search_activities'
	| 'summarize_deals'
	| 'summarize_customers'
	| 'summarize_activities'
	| 'get_customer_detail'
	| 'get_customer_health_score'
	| 'get_customer_health_ranking'
	| 'get_customer_handover_summary'
	| 'create_word_document'
	| 'create_excel_workbook'
	| 'create_powerpoint_presentation'
	| 'get_customers'
	| 'get_customer'
	| 'create_customer'
	| 'update_customer'
	| 'delete_customer'
	| 'create_customer_with_contact'
	| 'get_contacts'
	| 'create_contact'
	| 'update_contact'
	| 'get_deals'
	| 'create_deal'
	| 'update_deal'
	| 'get_activities'
	| 'create_activity'
	| 'send_email'
	| 'create_reminder'
	| 'list_entity_types'
	| 'create_app'
	| 'get_entity_fields'
	| 'create_entity_type'
	| 'add_entity_field'
	| 'get_entities'
	| 'create_entity'
	| 'update_entity'
	| 'list_approvals'
	| 'get_approval'
	| 'create_approval'
	| 'update_approval_step'
	| 'cancel_approval';

export async function dispatchTool(
	db: Db,
	name: ToolName,
	input: unknown,
	env?: ToolEnv,
	ctx?: ExecutionContext
) {
	switch (name) {
		case 'list_integrations':   return handleListIntegrations(db);
		case 'call_external_api':   return handleCallExternalApi(db, input);
		case 'search_customers':    return handleSearchCustomers(db, input);
		case 'search_deals':        return handleSearchDeals(db, input);
		case 'search_activities':   return handleSearchActivities(db, input);
		case 'summarize_deals':      return handleSummarizeDeals(db, input);
		case 'summarize_customers':  return handleSummarizeCustomers(db, input);
		case 'summarize_activities': return handleSummarizeActivities(db, input);
		case 'get_customer_detail': return handleGetCustomerDetail(db, input);
		case 'get_customer_health_score': return handleGetCustomerHealthScore(db, input, env);
		case 'get_customer_health_ranking': return handleGetCustomerHealthRanking(db, input);
		case 'get_customer_handover_summary': return handleGetCustomerHandoverSummary(db, input, env);
		case 'create_word_document': return handleCreateWordDocument(db, input, env, ctx);
		case 'create_excel_workbook': return handleCreateExcelWorkbook(db, input, env, ctx);
		case 'create_powerpoint_presentation': return handleCreatePowerpointPresentation(db, input, env, ctx);
		case 'get_customers':      return handleGetCustomers(db, input);
		case 'get_customer':       return handleGetCustomer(db, input);
		case 'create_customer':    return handleCreateCustomer(db, input);
		case 'update_customer':    return handleUpdateCustomer(db, input);
		case 'delete_customer':    return handleDeleteCustomer(db, input);
		case 'create_customer_with_contact': return handleCreateCustomerWithContact(db, input);
		case 'get_contacts':       return handleGetContacts(db, input);
		case 'create_contact':     return handleCreateContact(db, input);
		case 'update_contact':     return handleUpdateContact(db, input);
		case 'get_deals':          return handleGetDeals(db, input);
		case 'create_deal':        return handleCreateDeal(db, input, env);
		case 'update_deal':        return handleUpdateDeal(db, input);
		case 'get_activities':     return handleGetActivities(db, input);
		case 'create_activity':    return handleCreateActivity(db, input, env);
		case 'send_email':         return handleSendEmail(db, input, env);
		case 'create_reminder':    return handleCreateReminder(db, input, env);
		case 'list_entity_types':  return handleListEntityTypes(db);
		case 'create_app':         return handleCreateApp(db, input);
		case 'get_entity_fields':  return handleGetEntityFields(db, input);
		case 'create_entity_type': return handleCreateEntityType(db, input);
		case 'add_entity_field':   return handleAddEntityField(db, input);
		case 'get_entities':       return handleGetEntities(db, input);
		case 'create_entity':      return handleCreateEntity(db, input);
		case 'update_entity':      return handleUpdateEntity(db, input);
		case 'list_approvals':     return handleListApprovals(db, input);
		case 'get_approval':       return handleGetApproval(db, input);
		case 'create_approval':    return handleCreateApproval(db, input, env);
		case 'update_approval_step': return handleUpdateApprovalStep(db, input, env);
		case 'cancel_approval':    return handleCancelApproval(db, input);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
