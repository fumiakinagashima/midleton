import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

export const tools: Tool[] = [
	{
		name: 'get_help',
		description:
			'Get usage instructions or a feature explanation. Call this when the user asks something like "how do I use this?", "what can you do?", "help", or "how do I use feature X?". Omitting topic returns an overview.',
		input_schema: {
			type: 'object',
			properties: {
				topic: {
					type: 'string',
					enum: ['overview', 'customers', 'deals', 'activities', 'reminders', 'email'],
					description: 'The topic to look up (omit for an overview)'
				}
			}
		}
	}
];

const getHelpInputSchema = z.object({
	topic: z.enum(['overview', 'customers', 'deals', 'activities', 'reminders', 'email']).optional()
});

const HELP: Record<string, object> = {
	overview: {
		title: 'Midleton usage guide',
		description: 'An AI-first CRM/SFA system where customer management, deal management, and document creation are all completed just by giving instructions in chat',
		features: [
			{ name: 'Customer & contact management', topic: 'customers', examples: ['Register Acme Corp', 'Find Tanaka\'s company', 'Scan a business card and register it'] },
			{ name: 'Deal management', topic: 'deals', examples: ['Create a new deal for Acme Corp', 'How are this month\'s deals going?'] },
			{ name: 'Activity history', topic: 'activities', examples: ['Log a call with Acme Corp', 'Show last week\'s activity list'] },
			{ name: 'Reminders', topic: 'reminders', examples: ['Remind me to follow up at 10am tomorrow'] },
			{ name: 'Sending email', topic: 'email', examples: ['Send a thank-you email to Acme Corp'] }
		],
		tips: [
			'Just describe what you need in natural language',
			'To learn more about a specific feature, ask something like "how do I use customer management?"',
			'You can also manage data and change settings directly from the "Data Management" and "Settings" links in the side menu',
			'To delete a customer, deal, contact, or activity, click its row in a list to open the detail dialog, then use the "Delete" button in the top right'
		],
		relatedPages: [
			{ label: 'Data Management', href: '/database', description: 'Manage customers, deals, activities, and other data directly' },
			{ label: 'Settings', href: '/settings', description: 'Change the app\'s various settings' }
		]
	},
	customers: {
		title: 'Customer & contact management',
		operations: [
			{ action: 'Register a customer', examples: ['Register Acme Corp as a customer', 'I want to add a new customer'] },
			{ action: 'Register a customer and a contact together', examples: ['Register Acme Corp along with their contact Tanaka'] },
			{ action: 'Scan and register from a business card', examples: ['I want to scan and register a business card', 'I want to scan a business card'] },
			{ action: 'Search or list customers', examples: ['Find Tanaka\'s company', 'Show me the customer list for Tokyo'] },
			{ action: 'Update customer information', examples: ['Change Acme Corp\'s email address', 'Set Acme Corp\'s status to inactive'] },
			{ action: 'Delete customer information', description: 'Click a row in the customer list (in chat or Data Management) to open the detail dialog, then use the "Delete" button in the top right', examples: ['I want to delete Acme Corp', 'Remove Acme Corp\'s information'] },
			{ action: 'Add a contact', examples: ['Register Suzuki as a contact at Acme Corp'] },
			{ action: 'View customer details', examples: ['Show me all of Acme Corp\'s deals, activity, and contacts'] },
			{ action: 'Check the health score', examples: ['Is our relationship with Acme Corp healthy?', 'Which customers have a low score?'] },
			{ action: 'Create a handover summary', examples: ['Put together a handover summary for Acme Corp', 'Summarize our interactions with Acme Corp'] }
		],
		relatedPages: [
			{ label: 'Customer list', href: '/database/customers', description: 'List, register, edit, and delete customers' }
		]
	},
	deals: {
		title: 'Deal management',
		operations: [
			{ action: 'Register a deal', examples: ['Create a system rollout deal for Acme Corp'] },
			{ action: 'View a deal list or summary', examples: ['How are this month\'s deals going?', 'What\'s the total amount of won deals?', 'Show me deals on a Gantt chart', 'Show me the sales pipeline as a kanban board'] },
			{ action: 'Update a deal\'s status', examples: ['Mark the Acme Corp deal as won', 'The Acme Corp deal was lost'] },
			{ action: 'Delete a deal', description: 'Click a row in the deal list (in chat or Data Management) to open the detail dialog, then use the "Delete" button in the top right', examples: ['I want to delete the Acme Corp deal', 'Remove Acme Corp\'s deal'] }
		],
		statusValues: [
			{ value: 'open', label: 'In Progress' },
			{ value: 'won', label: 'Won' },
			{ value: 'lost', label: 'Lost' }
		],
		relatedPages: [
			{ label: 'Deal list', href: '/database/deals', description: 'List, register, edit, and delete deals' }
		]
	},
	activities: {
		title: 'Activity history',
		operations: [
			{ action: 'Log an activity', examples: ['Log a call with Acme Corp', 'Add notes from my meeting with Acme Corp', 'I emailed Acme Corp'] },
			{ action: 'Review activity history', examples: ['What\'s our recent history with Acme Corp?', 'Show me this week\'s activity list'] },
			{ action: 'Delete an activity record', description: 'Click a row in the activity list (in chat or Data Management) to open the detail dialog, then use the "Delete" button in the top right', examples: ['Delete that activity record for Acme Corp', 'I want to remove an activity I logged by mistake'] }
		],
		activityTypes: [
			{ value: 'note', label: 'Note' },
			{ value: 'call', label: 'Call' },
			{ value: 'email', label: 'Email' },
			{ value: 'meeting', label: 'Meeting' }
		],
		relatedPages: [
			{ label: 'Activity list', href: '/database/activities', description: 'List, register, and delete activity records' }
		]
	},
	reminders: {
		title: 'Reminders',
		description: 'Sends a notification through the notification center, email, or Slack (if configured) at the date/time you specify',
		operations: [
			{ action: 'Set a reminder', examples: ['Remind me to follow up at 10am tomorrow', 'Remind me next Monday to submit a proposal to Acme Corp', 'Notify me about the meeting today at 15:00'] }
		],
		tips: [
			'You can choose the notification channel when you submit the form (notification center, email, or Slack)',
			'Slack notifications require configuring a webhook URL in the API integrations screen'
		],
		relatedPages: [
			{ label: 'Reminder management', href: '/reminder', description: 'View and delete registered reminders' },
			{ label: 'API integrations', href: '/settings/integrations', description: 'Configure a Slack webhook URL' }
		]
	},
	email: {
		title: 'Sending email',
		operations: [
			{ action: 'Compose and send an email', examples: ['Send a thank-you email to Acme Corp', 'Write a follow-up email to Tanaka', 'Draft a proposal email for Acme Corp'] }
		],
		tips: [
			'The AI drafts the email, then you review and edit it in a form before sending',
			'Before first use, you need to configure an email service on the email settings screen'
		],
		relatedPages: [
			{ label: 'Email settings', href: '/settings/email', description: 'Configure the email sending service' }
		]
	}
};

export function handleGetHelp(input: unknown) {
	const { topic } = getHelpInputSchema.parse(input ?? {});
	return HELP[topic ?? 'overview'];
}

// Feature index embedded in the system prompt at all times. Using HELP as the single source of
// truth keeps this from drifting out of sync with a manually-copied version in the prompt.
export function buildFeatureIndexText(): string {
	return Object.values(HELP)
		.filter((v): v is { title: string; operations: { action: string }[] } =>
			Array.isArray((v as { operations?: unknown }).operations)
		)
		.map((v) => `- ${v.title}: ${v.operations.map((o) => o.action).join(' / ')}`)
		.join('\n');
}
