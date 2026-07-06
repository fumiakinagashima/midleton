import { tick, untrack } from 'svelte';
import { marked } from 'marked';
import { filterXSS } from 'xss';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { chatSession } from '$lib/stores/chat-session.svelte';
import { chatHistory } from '$lib/stores/chat-history.svelte';
import { toast } from '$lib/stores/toast.svelte';
import * as m from '$lib/paraglide/messages.js';
import { type CoreType } from '$lib/components/dialog/field-adapter';
import {
	quickActionCatalog,
	DEFAULT_QUICK_ACTION_IDS,
	MAX_QUICK_ACTIONS,
	QUICK_ACTIONS_STORAGE_KEY,
	isQuickActionId,
	type QuickActionDef
} from '$lib/quick-actions/catalog';
import { CHAT_TITLE_MAX_LENGTH, CHAT_TEXTAREA_MAX_HEIGHT_PX, DEAL_STATUS_IDS } from '$lib/constants';
import type {
	Message,
	MessageContent,
	FormContent,
	ActionItem,
	KanbanContent,
	LinkContent,
	BizcardContent,
	ReplyContent
} from '$lib/types/chat';
import type { StreamEvent } from '$lib/server/ai/stream';
import type { PageData } from './$types';

export function renderMarkdown(text: string): string {
	return filterXSS(marked.parse(text, { async: false }) as string);
}

const ls = (key: string, def: string) =>
	typeof localStorage !== 'undefined' ? (localStorage.getItem(key) ?? def) : def;

function loadQuickActions(): QuickActionDef[] {
	const raw = ls(QUICK_ACTIONS_STORAGE_KEY, '');
	let ids: string[] = DEFAULT_QUICK_ACTION_IDS;
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) ids = parsed;
		} catch {
			// ignore malformed value, fall back to defaults
		}
	}
	const valid = ids.filter(isQuickActionId).slice(0, MAX_QUICK_ACTIONS);
	const ordered = valid.length > 0 ? valid : DEFAULT_QUICK_ACTION_IDS;
	return ordered
		.map((id) => quickActionCatalog.find((a) => a.id === id))
		.filter((a): a is QuickActionDef => !!a);
}

function seedMessageFromNotification(seed: { id: string; seedContent: MessageContent[] } | null): Message[] {
	if (!seed) return [];
	return [{ id: crypto.randomUUID(), role: 'assistant', contents: seed.seedContent, createdAt: new Date() }];
}

function seedMessagesFromChat(
	seed: { id: string; messages: { id: string; role: 'user' | 'assistant'; contents: MessageContent[]; createdAt: Date }[] } | null
): Message[] {
	if (!seed) return [];
	return seed.messages.map((msg) => ({ id: msg.id, role: msg.role, contents: msg.contents, createdAt: msg.createdAt }));
}

type PanelRecord = { type: string; recordId: string | null; view: 'detail' | 'form'; prefill?: Record<string, string> } | null;

// コアエンティティのCRUDツールフォームは FormDialog ではなく RecordDialog（REST + getTableInfo）で開く
const CORE_TOOL_TYPE: Record<string, CoreType> = {
	create_customer: 'customers', update_customer: 'customers',
	create_contact: 'contacts', update_contact: 'contacts',
	create_deal: 'deals', update_deal: 'deals',
	create_activity: 'activities', update_activity: 'activities'
};
const SNAKE_TO_CAMEL: Record<string, string> = {
	customer_id: 'customerId', postal_code: 'postalCode', name_kana: 'nameKana',
	planned_start: 'plannedStart', planned_end: 'plannedEnd'
};

// コアCRUDフォームを RecordDialog のパネル指定に変換。対象外（リマインダー等）は null。
function coreToolToPanel(form: FormContent): PanelRecord {
	// entity 属性が指定されている場合は RecordDialog で直接開く（カスタムテーブル含む）
	if (form.entity) {
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.key === 'id') continue;
			if (f.value != null && f.value !== '') prefill[f.key] = String(f.value);
		}
		return { type: form.entity, recordId: null, view: 'form', prefill };
	}
	const type = CORE_TOOL_TYPE[form.tool];
	if (!type) return null;
	if (form.tool.startsWith('update_')) {
		const recordId = form.fields.find((f) => f.key === 'id')?.value ?? null;
		if (!recordId) return null; // id 不明なら FormDialog にフォールバック
		return { type, recordId: String(recordId), view: 'form' };
	}
	const prefill: Record<string, string> = {};
	for (const f of form.fields) {
		if (f.key === 'id') continue;
		if (f.value != null && f.value !== '') prefill[SNAKE_TO_CAMEL[f.key] ?? f.key] = String(f.value);
	}
	return { type, recordId: null, view: 'form', prefill };
}

export function createChatState(getData: () => PageData) {
	let messages = $state<Message[]>(untrack(() => {
		const d = getData();
		return d.seedChat ? seedMessagesFromChat(d.seedChat) : seedMessageFromNotification(d.seedNotification);
	}));
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);
	let chatEl = $state<HTMLElement | null>(null);
	let inputWrapEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let enterToSend = $state(ls('enterToSend', 'true') !== 'false');
	let hasStarted = $state(untrack(() => {
		const d = getData();
		return !!d.seedNotification || (!!d.seedChat && d.seedChat.messages.length > 0);
	}));
	// 未開始（空のチャット）の入力欄はCSSで中央配置するため初回からそのまま表示（フェードなし）。
	// 既存チャットを開いた場合（seeded）だけ、JSが下部に配置するまで一瞬隠す。
	let inputReady = $state(untrack(() => !hasStarted));
	let currentChatId: string | null = untrack(() => getData().seedChat?.id ?? null);
	let quickActions = $state(loadQuickActions());
	let quickActionMenuOpen = $state(false);
	let panelForm = $state<FormContent | null>(null);
	let panelRecord = $state<PanelRecord>(null);

	// テーブル・ガントチャートは既定で --chat-width の中央カラムに収まる縮小表示にする。
	// ユーザーがコンポーネント上のボタンで個別に拡張表示にしたメッセージIDだけここに記録する。
	let expandedMessageIds = $state<Set<string>>(new Set());

	function isMessageWide(msg: Message): boolean {
		const hasWideContent = msg.contents.some((c) => c.type === 'table' || c.type === 'gantt');
		if (!hasWideContent) return false;
		return expandedMessageIds.has(msg.id);
	}

	function toggleMessageWidth(msgId: string) {
		const next = new Set(expandedMessageIds);
		if (next.has(msgId)) next.delete(msgId);
		else next.add(msgId);
		expandedMessageIds = next;
	}

	let streamingText = $state('');
	let streamingUIContents = $state<MessageContent[]>([]);

	$effect(() => {
		const handler = (e: StorageEvent) => {
			enterToSend = (localStorage.getItem('enterToSend') ?? 'true') !== 'false';
			if (e.key === QUICK_ACTIONS_STORAGE_KEY || e.key === null) {
				quickActions = loadQuickActions();
			}
		};
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	});

	// 通知一覧から ?notification=<id> 付きで遷移してきた場合、その内容をチャットの最初のメッセージとして表示する
	// 初回ロード時は +page.server.ts の load が SSR でシードするため messages/hasStarted の初期値に直接反映済み（ちらつき防止）。
	// この effect は同一ルート内でのクライアントサイド遷移（通知ドロワーから別の通知をクリック）時の追加反映を担う。
	let seededNotificationId: string | null = untrack(() => getData().seedNotification?.id ?? null);

	$effect(() => {
		const seed = getData().seedNotification;
		if (!seed || seed.id === seededNotificationId) return;
		seededNotificationId = seed.id;
		if (!hasStarted) hasStarted = true;
		messages = [
			...messages,
			{ id: crypto.randomUUID(), role: 'assistant', contents: seed.seedContent, createdAt: new Date() }
		];
	});

	// サイドバー履歴クリック等で `?id=` が変わった場合、その会話を復元する。
	// assignChatId() が発行した自分自身のURL変更（currentChatId と一致）では何もしない。
	$effect(() => {
		const urlChatId = page.url.searchParams.get('id');
		if (urlChatId === currentChatId) return;
		currentChatId = urlChatId;
		const seedChat = getData().seedChat;
		messages = seedMessagesFromChat(seedChat);
		hasStarted = !!seedChat && seedChat.messages.length > 0;
		streamingText = '';
		streamingUIContents = [];
		input = '';
	});

	// サイドバーの「新しいチャット」クリック時にチャット状態をリセットする
	// （"/" への遷移はコンポーネントインスタンスを再利用するため自動では戻らない）
	// マウント時点の値を基準に差分を検出する（絶対値チェックだと再マウント時に誤クリアされる）
	let mountedResetToken = chatSession.resetToken;
	$effect(() => {
		const token = chatSession.resetToken;
		if (token === mountedResetToken) return;
		mountedResetToken = token;
		messages = [];
		hasStarted = false;
		streamingText = '';
		streamingUIContents = [];
		seededNotificationId = null;
		input = '';
	});

	// 開いている間だけ document クリックを監視し、メニュー外クリックで閉じる
	// （setTimeout で開いた瞬間のクリックイベントを取りこぼす）
	$effect(() => {
		if (!quickActionMenuOpen) return;
		const close = () => (quickActionMenuOpen = false);
		const id = setTimeout(() => document.addEventListener('click', close), 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener('click', close);
		};
	});

	// Input position management
	function repositionInput(animate: boolean) {
		if (!inputWrapEl) return;
		if (!hasStarted) {
			// 未開始時はCSS（top:50% + translateY(-50%)）で中央寄せ。インラインを消してCSSに委ねる。
			inputWrapEl.style.transition = '';
			inputWrapEl.style.top = '';
			inputWrapEl.style.bottom = '';
			inputWrapEl.style.transform = '';
			return;
		}
		if (!chatEl) return;
		const containerH = chatEl.offsetHeight;
		const inputH = inputWrapEl.offsetHeight;
		// 中央→下部のスライドは top と transform を同時にアニメーションさせて滑らかにする
		inputWrapEl.style.transition = animate
			? 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
			: 'none';
		inputWrapEl.style.transform = 'translateX(-50%)';
		inputWrapEl.style.bottom = 'auto';
		inputWrapEl.style.top = `${containerH - inputH - 24}px`;
	}

	let isFirstEffect = true;
	$effect(() => {
		void hasStarted;
		const animate = !isFirstEffect;
		isFirstEffect = false;
		requestAnimationFrame(() => {
			repositionInput(animate);
			inputReady = true;
		});
	});

	$effect(() => {
		function handleResize() {
			requestAnimationFrame(() => repositionInput(false));
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function autoGrow() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const sh = textareaEl.scrollHeight;
		if (sh >= CHAT_TEXTAREA_MAX_HEIGHT_PX) {
			textareaEl.style.height = `${CHAT_TEXTAREA_MAX_HEIGHT_PX}px`;
			textareaEl.style.overflowY = 'auto';
		} else {
			textareaEl.style.height = sh + 'px';
			textareaEl.style.overflowY = 'hidden';
		}
		requestAnimationFrame(() => repositionInput(false));
	}

	async function scrollLatestToTop() {
		await tick();
		// wait for browser layout pass after DOM update
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		if (!listEl) return;
		const userMsgs = listEl.querySelectorAll('.message.user');
		const last = userMsgs[userMsgs.length - 1] as HTMLElement | undefined;
		if (!last) return;
		const containerTop = listEl.getBoundingClientRect().top;
		const msgTop = last.getBoundingClientRect().top;
		listEl.scrollTo({
			top: Math.max(0, listEl.scrollTop + msgTop - containerTop - 32),
			behavior: 'smooth'
		});
	}

	function addUserMessage(text: string, isFirst = false) {
		const message: Message = { id: crypto.randomUUID(), role: 'user', contents: [{ type: 'text', text }], createdAt: new Date() };
		messages = [...messages, message];
		persistMessage(message, isFirst ? text : undefined);
	}

	// 新規チャット（URLにidも notification も無い状態）で最初のメッセージを送る際、
	// Copilot/Claude.aiのようにチャットIDをURLへ付与する（履歴からの再アクセスを想定）
	function assignChatId() {
		const url = new URL(window.location.href);
		if (url.searchParams.has('id') || url.searchParams.has('notification')) return;
		const id = crypto.randomUUID();
		url.searchParams.set('id', id);
		currentChatId = id;
		goto(`${url.pathname}?${url.searchParams}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function chatTitleFrom(text: string): string {
		const t = text.trim().replace(/\s+/g, ' ');
		return t.length > CHAT_TITLE_MAX_LENGTH ? t.slice(0, CHAT_TITLE_MAX_LENGTH) + '…' : t;
	}

	async function persistMessage(message: Message, firstMessageText?: string) {
		if (!currentChatId) return;
		const chatId = currentChatId;
		try {
			await fetch(`/api/chats/${chatId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: message.id,
					role: message.role,
					contents: message.contents,
					...(firstMessageText ? { title: chatTitleFrom(firstMessageText) } : {})
				})
			});
		} catch {
			// 保存失敗時もチャット表示は継続する
		}
		if (firstMessageText) {
			chatHistory.prepend({ id: chatId, title: chatTitleFrom(firstMessageText), updatedAt: new Date().toISOString() });
			requestChatTitle(chatId, firstMessageText);
		}
	}

	async function requestChatTitle(chatId: string, message: string) {
		try {
			const res = await fetch(`/api/chats/${chatId}/title`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});
			if (!res.ok) return;
			const { title } = (await res.json()) as { title: string };
			if (title) chatHistory.updateTitle(chatId, title);
		} catch {
			// 失敗時は切り詰めタイトルのまま
		}
	}

	function resolveDocumentJob(msg: Message, jobId: string, result: LinkContent) {
		const idx = msg.contents.findIndex((c) => c.type === 'document_job' && c.jobId === jobId);
		if (idx === -1) return;
		msg.contents[idx] = result;
		persistMessage(msg);
	}

	function finalizeStreamingMessage() {
		const contents: MessageContent[] = [];
		if (streamingText.trim()) contents.push({ type: 'text', text: streamingText });
		for (const c of streamingUIContents) {
			contents.push(c);
		}
		if (contents.length === 0) {
			contents.push({ type: 'text', text: m.chat_error() });
		}
		hidePreviousDealKanban(contents);
		if (contents.length > 0) {
			const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents, createdAt: new Date() };
			messages = [...messages, message];
			persistMessage(message);
		}
		streamingText = '';
		streamingUIContents = [];
	}

	async function submitToChat(tool: string, data: Record<string, string>) {
		loading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data, history: messages })
			});
			const result = (await res.json()) as { contents: MessageContent[] };
			const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents: result.contents, createdAt: new Date() };
			messages = [...messages, message];
			persistMessage(message);
		} catch {
			const message: Message = {
				id: crypto.randomUUID(),
				role: 'assistant',
				contents: [{ type: 'text', text: m.chat_error() }],
				createdAt: new Date()
			};
			messages = [...messages, message];
			persistMessage(message);
		} finally {
			loading = false;
		}
	}

	// 案件のステータス（進行中/受注/失注）をそのまま列にしたカンバン。ドラッグ&ドロップで status を更新できる。
	function isDealStatusKanban(content: KanbanContent): boolean {
		const ids = content.columns.map((c) => c.id);
		return DEAL_STATUS_IDS.length === ids.length && DEAL_STATUS_IDS.every((id) => ids.includes(id));
	}

	function hidePreviousDealKanban(newContents: MessageContent[]) {
		const hasNewDealKanban = newContents.some((c) => c.type === 'kanban' && isDealStatusKanban(c));
		if (!hasNewDealKanban) return;
		for (const msg of messages) {
			let changed = false;
			for (const content of msg.contents) {
				if (content.type === 'kanban' && isDealStatusKanban(content) && !content.completed) {
					content.completed = true;
					changed = true;
				}
			}
			if (changed) persistMessage(msg);
		}
	}

	// 削除されたレコードを、同じテーブル種別の一覧テーブルから取り除く
	function removeRecordRow(entity: string, recordId: string) {
		for (const msg of messages) {
			let changed = false;
			for (const content of msg.contents) {
				if (content.type === 'table' && content.entity === entity) {
					const before = content.rows.length;
					content.rows = content.rows.filter((r) => String(r.id) !== recordId);
					if (content.rows.length !== before) changed = true;
				}
			}
			if (changed) persistMessage(msg);
		}
	}

	async function handleDealKanbanChange(cardId: string, status: string): Promise<boolean> {
		try {
			const res = await fetch(`/api/deals/${cardId}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			if (!res.ok) {
				toast.error('ステータスの更新に失敗しました');
				return false;
			}
			return true;
		} catch {
			toast.error('ステータスの更新に失敗しました');
			return false;
		}
	}

	async function sendMessage(text: string, isFirst = false) {
		addUserMessage(text, isFirst);
		loading = true;
		streamingText = '';
		streamingUIContents = [];
		await scrollLatestToTop();
		repositionInput(false); // recalculate after textarea shrinks back to 1 row

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});

			if (!res.ok || !res.body) {
				finalizeStreamingMessage();
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';
			let finalized = false;

			const finalize = () => {
				if (finalized) return;
				finalized = true;
				finalizeStreamingMessage();
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';

				for (const part of parts) {
					const line = part.trim();
					if (!line.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(line.slice(6)) as StreamEvent;
						if (event.type === 'delta') {
							streamingText += event.text;
						} else if (event.type === 'ui') {
							streamingUIContents = [...streamingUIContents, event.content];
						} else if (event.type === 'done') {
							finalize();
						} else if (event.type === 'error') {
							streamingText = m.chat_error();
							finalize();
						}
					} catch {
						// JSON parse error, skip
					}
				}
			}

			finalize();
		} catch {
			streamingText = '';
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					contents: [{ type: 'text', text: m.chat_error() }],
					createdAt: new Date()
				}
			];
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		const text = input.trim();
		if (!text || loading) return;
		input = '';
		if (textareaEl) textareaEl.style.height = 'auto';
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		await sendMessage(text, isFirst);
	}

	async function handleActionSelect(action: ActionItem) {
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		await sendMessage(action.label, isFirst);
	}

	async function handleReplySubmit(msg: Message, content: ReplyContent, answer: string) {
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		content.completed = true;
		persistMessage(msg);
		await sendMessage(answer, isFirst);
	}

	async function handlePanelSubmit(tool: string, data: Record<string, string>) {
		panelForm = null;
		await submitToChat(tool, data);
	}

	function handlePanelCancel() {
		panelForm = null;
	}

	function handleBizcardComplete(msg: Message, bizcardContent: BizcardContent) {
		bizcardContent.completed = true;
		persistMessage(msg);
	}

	function handleFormButtonClick(content: FormContent) {
		const asRecord = coreToolToPanel(content);
		if (asRecord) panelRecord = asRecord;
		else panelForm = content;
	}

	function openRecordDetail(entity: string, recordId: string) {
		panelRecord = { type: entity, recordId, view: 'detail' };
	}

	function closePanelRecord() {
		panelRecord = null;
	}

	function handleRecordDeleted(id: string) {
		const entity = panelRecord?.type;
		panelRecord = null;
		if (entity) removeRecordRow(entity, id);
	}

	async function runQuickAction(action: QuickActionDef) {
		quickActionMenuOpen = false;
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		addUserMessage(action.label, isFirst);
		loading = true;
		await scrollLatestToTop();
		try {
			const res = await fetch('/api/quick-actions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: action.id })
			});
			const result = (await res.json()) as { contents: MessageContent[] };
			const formContent = result.contents.find((c) => c.type === 'form') as FormContent | undefined;
			const otherContents = result.contents.filter((c) => c.type !== 'form');
			if (otherContents.length > 0) {
				hidePreviousDealKanban(otherContents);
				const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents: otherContents, createdAt: new Date() };
				messages = [...messages, message];
				persistMessage(message);
			}
			if (formContent) {
				handleFormButtonClick(formContent);
			}
		} catch {
			const message: Message = {
				id: crypto.randomUUID(),
				role: 'assistant',
				contents: [{ type: 'text', text: m.chat_error() }],
				createdAt: new Date()
			};
			messages = [...messages, message];
			persistMessage(message);
		} finally {
			loading = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (enterToSend && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			handleSubmit();
		}
	}

	return {
		get input() { return input; },
		set input(v) { input = v; },
		get loading() { return loading; },
		get listEl() { return listEl; },
		set listEl(v) { listEl = v; },
		get chatEl() { return chatEl; },
		set chatEl(v) { chatEl = v; },
		get inputWrapEl() { return inputWrapEl; },
		set inputWrapEl(v) { inputWrapEl = v; },
		get textareaEl() { return textareaEl; },
		set textareaEl(v) { textareaEl = v; },
		get enterToSend() { return enterToSend; },
		get hasStarted() { return hasStarted; },
		get inputReady() { return inputReady; },
		get quickActions() { return quickActions; },
		get quickActionMenuOpen() { return quickActionMenuOpen; },
		set quickActionMenuOpen(v) { quickActionMenuOpen = v; },
		get panelForm() { return panelForm; },
		get panelRecord() { return panelRecord; },
		get messages() { return messages; },
		autoGrow,
		handleSubmit,
		handleActionSelect,
		handleReplySubmit,
		handlePanelSubmit,
		handlePanelCancel,
		handleBizcardComplete,
		resolveDocumentJob,
		handleFormButtonClick,
		openRecordDetail,
		closePanelRecord,
		handleRecordDeleted,
		runQuickAction,
		handleDealKanbanChange,
		isDealStatusKanban,
		isMessageWide,
		toggleMessageWidth,
		handleKey
	};
}
