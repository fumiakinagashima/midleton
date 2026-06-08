export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date';

export type FormField = {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	placeholder?: string;
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

export type MessageContent = TextContent | FormContent | TableContent | ActionContent;

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	contents: MessageContent[];
	createdAt: Date;
};
