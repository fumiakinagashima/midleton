import { eq, desc, inArray } from 'drizzle-orm';
import { approvalRequests } from './schema';
import type { Db } from '.';

export type ApprovalStep = {
	step: number;
	approver: string;
	email?: string;
	role?: string;
	status: 'pending' | 'approved' | 'rejected';
	comment: string | null;
	acted_at: string | null;
};

export type ApprovalRow = {
	id: string;
	title: string;
	type: string;
	entityType: string | null;
	entityId: string | null;
	status: 'pending' | 'approved' | 'rejected' | 'cancelled';
	submittedBy: string;
	data: Record<string, unknown>;
	route: ApprovalStep[];
	createdAt: Date;
	updatedAt: Date;
};

function parseRoute(raw: string): ApprovalStep[] {
	try { return JSON.parse(raw) ?? []; } catch { return []; }
}
function parseData(raw: string): Record<string, unknown> {
	try { return JSON.parse(raw) ?? {}; } catch { return {}; }
}
function toRow(r: typeof approvalRequests.$inferSelect): ApprovalRow {
	return {
		id: r.id,
		title: r.title,
		type: r.type,
		entityType: r.entityType,
		entityId: r.entityId,
		status: r.status as ApprovalRow['status'],
		submittedBy: r.submittedBy,
		data: parseData(r.data),
		route: parseRoute(r.route),
		createdAt: r.createdAt,
		updatedAt: r.updatedAt
	};
}

function computeStatus(route: ApprovalStep[]): ApprovalRow['status'] {
	if (route.length === 0) return 'pending';
	if (route.some(s => s.status === 'rejected')) return 'rejected';
	if (route.every(s => s.status === 'approved')) return 'approved';
	return 'pending';
}

export async function listApprovals(
	db: Db,
	filters?: { status?: string[]; type?: string }
): Promise<ApprovalRow[]> {
	const rows = await db
		.select()
		.from(approvalRequests)
		.orderBy(desc(approvalRequests.createdAt));

	return rows
		.filter(r => {
			if (filters?.status?.length && !filters.status.includes(r.status)) return false;
			if (filters?.type && r.type !== filters.type) return false;
			return true;
		})
		.map(toRow);
}

export async function getApproval(db: Db, id: string): Promise<ApprovalRow | null> {
	const [r] = await db
		.select()
		.from(approvalRequests)
		.where(eq(approvalRequests.id, id));
	return r ? toRow(r) : null;
}

export type CreateApprovalInput = {
	title: string;
	type: string;
	submittedBy: string;
	entityType?: string;
	entityId?: string;
	data?: Record<string, unknown>;
	route: Array<{ step: number; approver: string; email?: string; role?: string }>;
};

export async function createApproval(db: Db, input: CreateApprovalInput): Promise<ApprovalRow> {
	const id = crypto.randomUUID();
	const now = new Date();
	const route: ApprovalStep[] = input.route.map(s => ({
		step: s.step,
		approver: s.approver,
		email: s.email,
		role: s.role,
		status: 'pending',
		comment: null,
		acted_at: null
	}));

	await db.insert(approvalRequests).values({
		id,
		title: input.title,
		type: input.type,
		submittedBy: input.submittedBy,
		entityType: input.entityType ?? null,
		entityId: input.entityId ?? null,
		data: JSON.stringify(input.data ?? {}),
		route: JSON.stringify(route),
		status: 'pending',
		createdAt: now,
		updatedAt: now
	});

	return (await getApproval(db, id))!;
}

export async function updateApprovalStep(
	db: Db,
	id: string,
	stepIndex: number,
	action: 'approve' | 'reject',
	comment?: string
): Promise<ApprovalRow> {
	const existing = await getApproval(db, id);
	if (!existing) throw new Error(`申請が見つかりません: ${id}`);
	if (existing.status === 'cancelled') throw new Error('取り消し済みの申請は操作できません');

	const route = [...existing.route];
	if (stepIndex < 0 || stepIndex >= route.length) throw new Error(`ステップが存在しません: ${stepIndex}`);

	route[stepIndex] = {
		...route[stepIndex],
		status: action === 'approve' ? 'approved' : 'rejected',
		comment: comment ?? null,
		acted_at: new Date().toISOString()
	};

	const newStatus = computeStatus(route);

	await db
		.update(approvalRequests)
		.set({
			route: JSON.stringify(route),
			status: newStatus,
			updatedAt: new Date()
		})
		.where(eq(approvalRequests.id, id));

	return (await getApproval(db, id))!;
}

export async function cancelApproval(db: Db, id: string): Promise<ApprovalRow> {
	const existing = await getApproval(db, id);
	if (!existing) throw new Error(`申請が見つかりません: ${id}`);

	await db
		.update(approvalRequests)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(approvalRequests.id, id));

	return (await getApproval(db, id))!;
}

export async function deleteApproval(db: Db, id: string): Promise<void> {
	await db.delete(approvalRequests).where(eq(approvalRequests.id, id));
}
