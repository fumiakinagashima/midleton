import type { MessageContent } from '$lib/types/chat';

const MOCK_RESPONSES: MessageContent[][] = [
	[
		{ type: 'text', text: 'Registering customer information. Please fill out the form below.' },
		{
			type: 'form',
			title: 'Register customer',
			tool: 'create_customer',
			fields: [
				{ key: 'name', label: 'Company name', type: 'text', required: true, placeholder: 'Acme Inc.' },
				{ key: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
				{ key: 'phone', label: 'Phone', type: 'tel', placeholder: '555-000-0000' },
				{ key: 'postal_code', label: 'Postal code', type: 'text', placeholder: '10001' },
				{ key: 'address', label: 'Address', type: 'text', placeholder: '123 Main St...' },
				{ key: 'website', label: 'Website', type: 'text', placeholder: 'https://example.com' },
				{
					key: 'status',
					label: 'Status',
					type: 'select',
					options: [
						{ value: 'lead', label: 'Lead' },
						{ value: 'active', label: 'Active' },
						{ value: 'inactive', label: 'Inactive' }
					]
				},
				{ key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Free text' }
			]
		}
	],
	[
		{ type: 'text', text: 'Here is the list of registered customers.' },
		{
			type: 'table',
			columns: [
				{ key: 'name', label: 'Company name' },
				{ key: 'email', label: 'Email' },
				{ key: 'status', label: 'Status' }
			],
			rows: [
				{ name: 'Alcogy Inc.', email: 'jane@alcogy.com', status: 'active' },
				{ name: 'Test Trading Co.', email: 'hanako@test.co.jp', status: 'lead' },
				{ name: 'Sample Corp.', email: 'jiro@sample.jp', status: 'inactive' }
			]
		}
	],
	[
		{ type: 'text', text: 'Hi! This is Midleton CRM. How can I help you?' },
		{
			type: 'actions',
			title: 'Choose an action',
			actions: [
				{ id: 'create', label: 'Register a customer', description: 'Enter new customer information in a form' },
				{ id: 'list', label: 'View customer list', description: 'Show the list of registered customers' },
				{ id: 'report', label: 'View report', description: 'Show the monthly revenue report' }
			]
		}
	],
	[
		{ type: 'text', text: 'Let\'s scan a business card. Take a photo with your camera, or upload an image.' },
		{
			type: 'bizcard',
			title: 'Please scan a business card'
		}
	]
];

let mockIndex = 0;

export function mockChat(): MessageContent[] {
	const contents = MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length];
	mockIndex++;
	return contents;
}
