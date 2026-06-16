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
import type { LinkContent, DocumentJobContent } from '$lib/types/chat';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'create_word_document',
		description:
			'見出し・段落・表からWord文書（.docx）を生成し、ダウンロードリンクを返す。社内向けの報告書・議事録など文章中心の資料に向く。「営業会議資料をWordで作って」などに使う。事前に summarize_deals / get_deals / search_deals / get_customer_detail 等で必要なデータを取得・集計してから、その内容を blocks に構成して渡す。',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'ファイル名（拡張子なし。例: "2026年6月_営業会議資料"）'
				},
				title: {
					type: 'string',
					description: '文書タイトル（任意。文書冒頭に大きく表示される）'
				},
				blocks: {
					type: 'array',
					description: '文書の内容を順番に並べたブロックの配列',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: ['heading', 'paragraph', 'table'],
								description: 'ブロック種別'
							},
							level: {
								type: 'number',
								enum: [1, 2, 3],
								description: 'type が heading のときの見出しレベル（省略時1）'
							},
							text: {
								type: 'string',
								description: 'type が heading / paragraph のときの本文テキスト'
							},
							columns: {
								type: 'array',
								description: 'type が table のときの列定義',
								items: {
									type: 'object',
									properties: { key: { type: 'string' }, label: { type: 'string' } },
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								description:
									'type が table のときの行データ（columns の key をキーとするオブジェクトの配列）',
								items: { type: 'object', description: '列キー: 値の組' }
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
			'シート・列・行データからExcelファイル（.xlsx）を生成し、ダウンロードリンクを返す。案件一覧・集計表など表形式データに向く。「案件状況をExcelでまとめて」などに使う。事前に summarize_deals / get_deals / search_deals 等で必要なデータを取得・集計してから、その内容を sheets に構成して渡す。',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'ファイル名（拡張子なし。例: "2026年6月_案件一覧"）'
				},
				sheets: {
					type: 'array',
					description: 'シートの配列',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string', description: 'シート名' },
							columns: {
								type: 'array',
								description: '列定義（表示順）',
								items: {
									type: 'object',
									properties: {
										key: { type: 'string' },
										label: { type: 'string' },
										width: { type: 'number', description: '列幅（任意）' }
									},
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								description: '行データ（columns の key をキーとするオブジェクトの配列）',
								items: { type: 'object', description: '列キー: 値の組' }
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
			'タイトル・本文・表からPowerPointプレゼンテーション（.pptx）を生成し、ダウンロードリンクを返す。会議・プレゼン用のスライド資料に向く。「営業会議用にスライドを作って」などに使う。事前に summarize_deals / get_deals / search_deals 等で必要なデータを取得・集計してから、その内容を slides に構成して渡す。',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'ファイル名（拡張子なし。例: "2026年6月_営業会議"）'
				},
				title: { type: 'string', description: '表紙スライドのタイトル（任意）' },
				slides: {
					type: 'array',
					description: 'スライドの配列（表紙の後に1スライドずつ追加される）',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'スライドタイトル（任意）' },
							body: {
								type: 'array',
								items: { type: 'string' },
								description: '箇条書き本文（任意）'
							},
							table: {
								type: 'object',
								description: '表（任意）',
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
										items: { type: 'object', description: '列キー: 値の組' }
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
				seedContent: [
					{ type: 'text', text: `資料「${label}」の生成に失敗しました: ${message}` }
				],
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

export async function handleCreateWordDocument(
	db: Db,
	input: unknown,
	env?: ToolEnv,
	ctx?: ExecutionContext
) {
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
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
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
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
	if (!env?.R2) throw new Error('R2が設定されていないため資料を生成できません');
	const r2 = env.R2;
	const { filename, title, slides } = createPowerpointPresentationSchema.parse(input);
	const label = `${filename}.pptx`;

	return runDocumentJob(db, env, ctx, label, async () => {
		const buffer = await generatePowerpointPresentation({ title, slides });
		return saveGeneratedDocument(r2, buffer, label, 'pptx');
	});
}
