import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { createNotification } from '../db/notification-service';
import {
	generateWordDocument,
	generateExcelWorkbook,
	generatePowerpointPresentation,
	saveGeneratedDocument,
	type WordBlock
} from '../documents';
import { uploadR2 } from '../r2-service';
import type { LinkContent, DocumentJobContent } from '$lib/types/chat';
import type { ToolEnv } from './shared';

// Tools exposed to the AI (the old direct-generation tools below have since been unpublished)
export const tools: Tool[] = [
	{
		name: 'build_handoff_data',
		description:
			'Formats data fetched from the DB into a CSV/Markdown file, saves it to R2, and returns a download link together with a prompt for an external AI tool. Used for document-creation requests like "put this together in Excel" or "make me a report". First fetch the data with tools such as search_deals / search_customers / get_activities, then pass that content structured into tables.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'File name (without extension. e.g. "2026-06_deal-list")'
				},
				format: {
					type: 'string',
					enum: ['csv', 'markdown'],
					description: 'csv: tabular data (opens in Excel, etc.) / markdown: better suited for prose and multiple tables mixed together'
				},
				tables: {
					type: 'array',
					description: 'Array of tables (for CSV, multiple tables are concatenated; for Markdown, separated by ## headings)',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'Table title (optional)' },
							columns: {
								type: 'array',
								items: {
									type: 'object',
									properties: { key: { type: 'string' }, label: { type: 'string' } },
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								items: { type: 'object', description: 'Object of column key: value pairs' }
							}
						},
						required: ['columns', 'rows']
					}
				},
				prompt: {
					type: 'string',
					description: 'The prompt to hand this data file to an external AI tool (Copilot/Canvas/ChatGPT, etc.) — write it so the user can copy and paste it as-is'
				}
			},
			required: ['filename', 'format', 'tables', 'prompt']
		}
	}
];

// Old direct-generation tools (code kept for reference; not exposed to the AI)
const _legacyTools: Tool[] = [
	{
		name: 'create_word_document',
		description:
			'Generates a Word document (.docx) from headings, paragraphs, and tables, and returns a download link. Well suited for text-centric internal documents such as reports or meeting minutes. Used for requests like "make the sales meeting materials in Word". First fetch and aggregate the necessary data with tools like summarize_deals / get_deals / search_deals / get_customer_detail, then pass that content structured into blocks.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'File name (without extension. e.g. "2026-06_sales-meeting-materials")'
				},
				title: {
					type: 'string',
					description: 'Document title (optional; displayed prominently at the top of the document)'
				},
				blocks: {
					type: 'array',
					description: 'Array of blocks making up the document content, in order',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: ['heading', 'paragraph', 'table'],
								description: 'Block type'
							},
							level: {
								type: 'number',
								enum: [1, 2, 3],
								description: 'Heading level when type is heading (default 1)'
							},
							text: {
								type: 'string',
								description: 'Body text when type is heading / paragraph'
							},
							columns: {
								type: 'array',
								description: 'Column definitions when type is table',
								items: {
									type: 'object',
									properties: { key: { type: 'string' }, label: { type: 'string' } },
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								description:
									'Row data when type is table (array of objects keyed by the column keys)',
								items: { type: 'object', description: 'Object of column key: value pairs' }
							}
						},
						required: ['type']
					}
				}
			},
			required: ['filename', 'blocks']
		}
	},
	{
		name: 'create_excel_workbook',
		description:
			'Generates an Excel file (.xlsx) from sheets, columns, and row data, and returns a download link. Well suited for tabular data such as a deal list or a summary table. Used for requests like "summarize the deal status in Excel". First fetch and aggregate the necessary data with tools like summarize_deals / get_deals / search_deals, then pass that content structured into sheets.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'File name (without extension. e.g. "2026-06_deal-list")'
				},
				sheets: {
					type: 'array',
					description: 'Array of sheets',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string', description: 'Sheet name' },
							columns: {
								type: 'array',
								description: 'Column definitions (display order)',
								items: {
									type: 'object',
									properties: {
										key: { type: 'string' },
										label: { type: 'string' },
										width: { type: 'number', description: 'Column width (optional)' }
									},
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								description: 'Row data (array of objects keyed by the column keys)',
								items: { type: 'object', description: 'Object of column key: value pairs' }
							}
						},
						required: ['name', 'columns', 'rows']
					}
				}
			},
			required: ['filename', 'sheets']
		}
	},
	{
		name: 'create_powerpoint_presentation',
		description:
			'Generates a PowerPoint presentation (.pptx) from titles, body text, and tables, and returns a download link. Well suited for meeting/presentation slide decks. Used for requests like "make slides for the sales meeting". First fetch and aggregate the necessary data with tools like summarize_deals / get_deals / search_deals, then pass that content structured into slides.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'File name (without extension. e.g. "2026-06_sales-meeting")'
				},
				title: { type: 'string', description: 'Title of the cover slide (optional)' },
				slides: {
					type: 'array',
					description: 'Array of slides (each is added one at a time after the cover slide)',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'Slide title (optional)' },
							body: {
								type: 'array',
								items: { type: 'string' },
								description: 'Bullet-point body text (optional)'
							},
							table: {
								type: 'object',
								description: 'Table (optional)',
								properties: {
									columns: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												key: { type: 'string' },
												label: { type: 'string' }
											},
											required: ['key', 'label']
										}
									},
									rows: {
										type: 'array',
										items: { type: 'object', description: 'Object of column key: value pairs' }
									}
								}
							}
						}
					}
				}
			},
			required: ['filename', 'slides']
		}
	}
];

// --- build_handoff_data ---

const handoffTableSchema = z.object({
	title: z.string().optional(),
	columns: z.array(z.object({ key: z.string(), label: z.string() })),
	rows: z.array(z.record(z.string(), z.unknown()))
});

const buildHandoffDataSchema = z.object({
	filename: z.string().min(1),
	format: z.enum(['csv', 'markdown']),
	tables: z.array(handoffTableSchema).min(1),
	prompt: z.string().min(1)
});

function tablesToCsv(tables: z.infer<typeof handoffTableSchema>[]): string {
	return tables
		.map((t) => {
			const headerRow = t.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
			const dataRows = t.rows.map((row) =>
				t.columns
					.map((c) => {
						const v = row[c.key];
						if (v == null) return '';
						return `"${String(v).replace(/"/g, '""')}"`;
					})
					.join(',')
			);
			return [t.title ? `"${t.title}"` : '', headerRow, ...dataRows].filter(Boolean).join('\r\n');
		})
		.join('\r\n\r\n');
}

function tablesToMarkdown(tables: z.infer<typeof handoffTableSchema>[]): string {
	return tables
		.map((t) => {
			const parts: string[] = [];
			if (t.title) parts.push(`## ${t.title}\n`);
			const header = '| ' + t.columns.map((c) => c.label).join(' | ') + ' |';
			const sep = '| ' + t.columns.map(() => '---').join(' | ') + ' |';
			const dataRows = t.rows.map(
				(row) => '| ' + t.columns.map((c) => String(row[c.key] ?? '')).join(' | ') + ' |'
			);
			parts.push([header, sep, ...dataRows].join('\n'));
			return parts.join('\n');
		})
		.join('\n\n');
}

export async function handleBuildHandoffData(input: unknown, env?: ToolEnv) {
	if (!env?.R2) throw new Error('R2 is not configured, so the data file cannot be saved');
	const { filename, format, tables, prompt } = buildHandoffDataSchema.parse(input);

	const ext = format === 'csv' ? 'csv' : 'md';
	const fullFilename = `${filename}.${ext}`;
	const content = format === 'csv' ? tablesToCsv(tables) : tablesToMarkdown(tables);
	const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8';

	const key = crypto.randomUUID();
	const buf = new TextEncoder().encode(content).buffer;
	await uploadR2(env.R2, key, buf as ArrayBuffer, { contentType });

	const downloadUrl = `/api/attachments/${key}?filename=${encodeURIComponent(fullFilename)}`;
	const label = `${filename} (${format.toUpperCase()})`;

	return { type: 'doc_handoff', downloadUrl, filename: fullFilename, label, prompt };
}

// --- Zod schemas for the old tools ---

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

const createExcelWorkbookSchema = z.object({
	filename: z.string().min(1),
	sheets: z.array(
		z.object({
			name: z.string(),
			columns: z.array(
				z.object({ key: z.string(), label: z.string(), width: z.number().optional() })
			),
			rows: z.array(z.record(z.string(), z.unknown()))
		})
	)
});

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

function toWordBlocks(blocks: z.infer<typeof wordBlockSchema>[]): WordBlock[] {
	return blocks.map((b) => {
		if (b.type === 'heading') return { type: 'heading', level: b.level, text: b.text ?? '' };
		if (b.type === 'paragraph') return { type: 'paragraph', text: b.text ?? '' };
		return { type: 'table', columns: b.columns ?? [], rows: b.rows ?? [] };
	});
}

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
	if (!env.KV) throw new Error('KV is not configured, so the document generation job cannot be managed');
	const kv = env.KV;
	const jobId = crypto.randomUUID();

	const put = (value: DocumentJobStatus) =>
		kv.put(`docjob:${jobId}`, JSON.stringify(value), { expirationTtl: 3600 });

	await put({ status: 'pending' });

	const finish = async () => {
		try {
			const result = await generate();
			await put({ status: 'done', result });
			if (env.accountId) {
				await createNotification(db, {
					type: 'document_job',
					title: `"${label}" is ready`,
					body: `"${label}" is ready to download.`,
					seedContent: [
						{ type: 'text', text: `Document "${label}" has finished generating.` },
						{ type: 'link', label: result.label, href: result.href, description: result.description }
					],
					accountId: env.accountId
				});
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			await put({ status: 'error', error: message });
			if (env.accountId) {
				await createNotification(db, {
					type: 'document_job',
					title: `Failed to generate "${label}"`,
					body: message,
					seedContent: [
						{ type: 'text', text: `Failed to generate document "${label}": ${message}` }
					],
					accountId: env.accountId
				});
			}
		}
	};

	if (ctx) {
		ctx.waitUntil(finish());
	} else {
		await finish();
	}

	return { type: 'document_job', jobId, label };
}

export async function handleCreateWordDocument(
	db: Db,
	input: unknown,
	env?: ToolEnv,
	ctx?: ExecutionContext
) {
	if (!env?.R2) throw new Error('R2 is not configured, so the document cannot be generated');
	const r2 = env.R2;
	const { filename, title, blocks } = createWordDocumentSchema.parse(input);
	const label = `${filename}.docx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generateWordDocument({ title, blocks: toWordBlocks(blocks) });
		return saveGeneratedDocument(r2, buffer, label, 'docx');
	});
}

export async function handleCreateExcelWorkbook(
	db: Db,
	input: unknown,
	env?: ToolEnv,
	ctx?: ExecutionContext
) {
	if (!env?.R2) throw new Error('R2 is not configured, so the document cannot be generated');
	const r2 = env.R2;
	const { filename, sheets } = createExcelWorkbookSchema.parse(input);
	const label = `${filename}.xlsx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generateExcelWorkbook(sheets);
		return saveGeneratedDocument(r2, buffer, label, 'xlsx');
	});
}

export async function handleCreatePowerpointPresentation(
	db: Db,
	input: unknown,
	env?: ToolEnv,
	ctx?: ExecutionContext
) {
	if (!env?.R2) throw new Error('R2 is not configured, so the document cannot be generated');
	const r2 = env.R2;
	const { filename, title, slides } = createPowerpointPresentationSchema.parse(input);
	const label = `${filename}.pptx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generatePowerpointPresentation({ title, slides });
		return saveGeneratedDocument(r2, buffer, label, 'pptx');
	});
}
