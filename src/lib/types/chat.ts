export type FieldType =
	| 'text'
	| 'email'
	| 'tel'
	| 'number'
	| 'textarea'
	| 'select'
	| 'date'
	| 'datetime-local'
	| 'hidden'
	| 'recordSelect'
	| 'multiselect';

export type FormField = {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	placeholder?: string;
	value?: string;
	options?: { label: string; value: string }[];
	refTable?: string;
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
	submitLabel?: string;
	completed?: boolean;
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
	completed?: boolean;
};

export type LinkContent = {
	type: 'link';
	label: string;
	href: string;
	description?: string;
	newTab?: boolean;
};

export type BizcardContent = {
	type: 'bizcard';
	title?: string;
	completed?: boolean;
};

export type DocumentJobContent = {
	type: 'document_job';
	jobId: string;
	label: string;
};

export type ReplyOption = {
	value: string;
	label: string;
};

export type ReplyField = {
	key: string;
	type: 'single' | 'multiple' | 'text' | 'number' | 'datetime';
	label?: string;
	options?: ReplyOption[];
	placeholder?: string;
};

export type ReplyContent = {
	type: 'reply';
	title?: string;
	fields: ReplyField[];
	submitLabel?: string;
	completed?: boolean;
};

export type CustomerDetailCustomer = {
	id: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	postal_code?: string | null;
	address?: string | null;
	website?: string | null;
	status?: string | null;
	notes?: string | null;
};

export type CustomerDetailContact = {
	id: string;
	name: string;
	role?: string | null;
	department?: string | null;
	email?: string | null;
	phone?: string | null;
};

export type CustomerDetailDeal = {
	id: string;
	title: string;
	amount?: number | null;
	status: string;
	plannedStart?: string | null;
	plannedEnd?: string | null;
};

export type CustomerDetailActivity = {
	id: string;
	type: string;
	content: string;
	createdAt: string | number;
};

export type CustomerDetailContent = {
	type: 'customer_detail';
	customer: CustomerDetailCustomer;
	contacts: CustomerDetailContact[];
	deals: CustomerDetailDeal[];
	activities: CustomerDetailActivity[];
};

export type WorkflowResultType = 'boolean' | 'number' | 'string';

/**
 * パラメータ・条件のオペランド値。文字列リテラルそのもの、または `@step:<id>` 形式で
 * 同じワークフロー内の先行ステップ（WorkflowActionStep）の結果を参照する。
 */
export type WorkflowOperand = string;

export type WorkflowActionStep = {
	id: string;
	kind: 'action';
	label: string;
	tool: string;
	params?: Record<string, WorkflowOperand>;
};

export type WorkflowConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

export type WorkflowConditionStep = {
	id: string;
	kind: 'condition';
	label: string;
	left: WorkflowOperand;
	operator: WorkflowConditionOperator;
	right: WorkflowOperand;
	then: WorkflowStep[];
};

export type WorkflowStep = WorkflowActionStep | WorkflowConditionStep;

export type WorkflowContent = {
	type: 'workflow';
	id?: string;
	name: string;
	triggerHour: number;
	triggerMinute: number;
	steps: WorkflowStep[];
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
	| BizcardContent
	| DocumentJobContent
	| ReplyContent
	| CustomerDetailContent
	| WorkflowContent;

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	contents: MessageContent[];
	createdAt: Date;
};
