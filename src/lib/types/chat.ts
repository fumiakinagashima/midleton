export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date' | 'hidden';

export type FormField = {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	placeholder?: string;
	value?: string;
	options?: { label: string; value: string }[];
};

export type TableColumn = {
	key: string;
	label: string;
};

export type TextContent = {
	type: 'text';
	text: string;
};

export type FormContent = {
	type: 'form';
	title?: string;
	fields: FormField[];
	tool: string;
};

export type TableContent = {
	type: 'table';
	columns: TableColumn[];
	rows: Record<string, unknown>[];
};

export type ActionItem = {
	id: string;
	label: string;
	description?: string;
};

export type ActionContent = {
	type: 'actions';
	title?: string;
	actions: ActionItem[];
};

export type ValueFormat = 'currency' | 'number' | 'date' | 'datetime' | 'text';

export type ValueItem = {
	label: string;
	value: string | number | null;
	format: ValueFormat;
};

export type ValuesContent = {
	type: 'values';
	title?: string;
	items: ValueItem[];
};

export type GanttContent = {
	type: 'gantt';
	title?: string;
	filter?: {
		status?: string[];
		customerId?: string;
	};
};

export type ChartSeries = { name: string; data: { label: string; value: number }[] };

export type ChartContent = {
	type: 'chart';
	chartType: 'bar' | 'line' | 'pie';
	title?: string;
	mode?: 'normal' | 'stacked' | 'grouped';
	data?: { label: string; value: number }[];
	series?: ChartSeries[];
};

export type KanbanColumn = {
	id: string;
	label: string;
};

export type KanbanCard = {
	id: string;
	title: string;
	subtitle?: string;
	amount?: number;
	columnId: string;
};

export type KanbanContent = {
	type: 'kanban';
	title?: string;
	columns: KanbanColumn[];
	cards: KanbanCard[];
};

export type LinkContent = {
	type: 'link';
	label: string;
	href: string;
	description?: string;
};

export type BizcardContent = {
	type: 'bizcard';
	title?: string;
};

export type MessageContent =
	| TextContent
	| FormContent
	| TableContent
	| ActionContent
	| ValuesContent
	| GanttContent
	| ChartContent
	| KanbanContent
	| LinkContent
	| BizcardContent;

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	contents: MessageContent[];
	createdAt: Date;
};
