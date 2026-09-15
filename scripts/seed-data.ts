// Generates demo data for customers, contacts, and deals.
// Used both for loading into local D1 (seed-demo-data.ts) and generating SQL for production D1 (generate-seed-sql.ts).

export type CustomerSeed = {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
	postalCode: string;
	website: string;
	status: 'active' | 'inactive';
	notes: string;
};

export type ContactSeed = {
	id: string;
	customerId: string;
	name: string;
	nameKana: string;
	email: string;
	phone: string;
	role: string;
	department: string;
};

export type DealSeed = {
	id: string;
	customerId: string;
	title: string;
	amount: number;
	status: 'open' | 'won' | 'lost';
	closedAt: Date | null;
	plannedStart: string;
	plannedEnd: string;
	notes: string;
};

export type ActivitySeed = {
	id: string;
	customerId: string;
	type: 'note' | 'call' | 'email' | 'meeting';
	content: string;
	createdBy: string;
	createdAt: Date;
};

export type SeedData = {
	customers: CustomerSeed[];
	contacts: ContactSeed[];
	deals: DealSeed[];
	activities: ActivitySeed[];
};

const TODAY = new Date(2026, 5, 16); // 2026-06-16

function fmtDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + days);
	return r;
}

function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
	return arr[randInt(0, arr.length - 1)];
}

function pickMany<T>(arr: T[], n: number): T[] {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

// Use a non-existent domain (RFC 2606) for email addresses to avoid accidental real sends
function dummyEmailDomain(domain: string): string {
	return `${domain.split('.')[0]}.example.test`;
}

type CompanyDef = {
	name: string;
	domain: string;
	phone: string;
	address: string;
	postalCode: string;
	status: 'active' | 'inactive';
	notes: string;
};

const companies: CompanyDef[] = [
	{ name: 'Sunrise Tech Solutions Inc.', domain: 'sunrise-tech.com', phone: '(415) 555-0142', address: '455 Market St, San Francisco, CA', postalCode: '94105', status: 'active', notes: 'Inquired through the website. Eager to move to the cloud.' },
	{ name: 'Westward Food Services LLC', domain: 'westward-foods.com', phone: '(312) 555-0199', address: '200 W Madison St, Chicago, IL', postalCode: '60601', status: 'active', notes: 'Operates roughly 50 restaurants across the Midwest.' },
	{ name: 'Greenline Builders Inc.', domain: 'greenline-builders.com', phone: '(212) 555-0166', address: '350 5th Ave, New York, NY', postalCode: '10001', status: 'active', notes: 'Handles construction and renovation of office and commercial buildings.' },
	{ name: 'Marlowe Trading Co.', domain: 'marlowe-trading.com', phone: '(212) 555-0120', address: '1 Wall Street Plaza, New York, NY', postalCode: '10005', status: 'active', notes: 'General trading company with significant overseas business.' },
	{ name: 'MedPartners Consulting Inc.', domain: 'medpartners-consulting.com', phone: '(617) 555-0134', address: '100 Federal St, Boston, MA', postalCode: '02110', status: 'active', notes: 'Provides consulting services to healthcare organizations.' },
	{ name: 'Forge Precision Manufacturing Inc.', domain: 'forge-precision.com', phone: '(313) 555-0177', address: '1400 Woodward Ave, Detroit, MI', postalCode: '48201', status: 'active', notes: 'Mid-sized manufacturer specializing in precision machining of auto parts.' },
	{ name: 'Cloud Nine Software Inc.', domain: 'cloud9-software.com', phone: '(512) 555-0188', address: '301 Congress Ave, Austin, TX', postalCode: '78701', status: 'active', notes: 'Fast-growing SaaS startup.' },
	{ name: 'Harborview Logistics Inc.', domain: 'harborview-logistics.com', phone: '(562) 555-0155', address: '200 Oceangate, Long Beach, CA', postalCode: '90802', status: 'active', notes: 'International logistics and warehousing operator.' },
	{ name: 'Magnolia Realty Group', domain: 'magnolia-realty.com', phone: '(404) 555-0143', address: '191 Peachtree St NE, Atlanta, GA', postalCode: '30303', status: 'active', notes: 'Focuses on commercial real estate across the Southeast.' },
	{ name: 'Meridian Pharmaceuticals Inc.', domain: 'meridian-pharma.com', phone: '(215) 555-0161', address: '1500 Market St, Philadelphia, PA', postalCode: '19102', status: 'active', notes: 'Generic drug manufacturer.' },
	{ name: 'Futurescape Design Studio', domain: 'futurescape-design.com', phone: '(323) 555-0129', address: '800 W 6th St, Los Angeles, CA', postalCode: '90012', status: 'active', notes: 'Design agency specializing in branding and advertising.' },
	{ name: 'Lakeside Auto Components Inc.', domain: 'lakeside-autoparts.com', phone: '(313) 555-0140', address: '2000 Michigan Ave, Detroit, MI', postalCode: '48226', status: 'active', notes: 'Tier-1 supplier to major automakers.' },
	{ name: 'EduSpark Learning Inc.', domain: 'eduspark-learning.com', phone: '(303) 555-0117', address: '1550 Court Pl, Denver, CO', postalCode: '80202', status: 'active', notes: 'Runs an online learning service.' },
	{ name: 'Summit Electronics Manufacturing', domain: 'summit-electronics.com', phone: '(602) 555-0173', address: '111 W Monroe St, Phoenix, AZ', postalCode: '85004', status: 'active', notes: 'Manufactures industrial electronic equipment.' },
	{ name: 'Harmony Hotel Group', domain: 'harmony-hotels.com', phone: '(305) 555-0198', address: '800 Brickell Ave, Miami, FL', postalCode: '33131', status: 'active', notes: 'Operates five hotels across Florida.' },
	{ name: 'Delta Harvest Co.', domain: 'delta-harvest.com', phone: '(901) 555-0111', address: '50 Peabody Pl, Memphis, TN', postalCode: '38103', status: 'inactive', notes: 'Produces and distributes agricultural products. Currently inactive.' },
	{ name: 'Nextwave Retail Inc.', domain: 'nextwave-retail.com', phone: '(206) 555-0152', address: '400 Pine St, Seattle, WA', postalCode: '98101', status: 'active', notes: 'Operates apparel and lifestyle goods stores nationwide.' },
	{ name: 'Beacon Consulting Group Inc.', domain: 'beacon-consulting.com', phone: '(202) 555-0136', address: '1200 K St NW, Washington, DC', postalCode: '20005', status: 'active', notes: 'Provides management strategy consulting.' },
	{ name: 'SmartWorks Factory Systems', domain: 'smartworks-factory.com', phone: '(412) 555-0148', address: '301 Grant St, Pittsburgh, PA', postalCode: '15222', status: 'inactive', notes: 'Promotes factory IoT and smart-factory adoption. Long dormant.' },
	{ name: 'Pacific Coast Seafood Co.', domain: 'pacific-seafood.com', phone: '(503) 555-0163', address: '111 SW 5th Ave, Portland, OR', postalCode: '97201', status: 'active', notes: 'Processes and sells seafood products.' }
];

type PersonDef = { name: string; kana: string; romaji: string };

const peoplePool: PersonDef[] = [
	{ name: 'James Carter', kana: '', romaji: 'jcarter' },
	{ name: 'Emily Johnson', kana: '', romaji: 'ejohnson' },
	{ name: 'Michael Brooks', kana: '', romaji: 'mbrooks' },
	{ name: 'Sarah Mitchell', kana: '', romaji: 'smitchell' },
	{ name: 'David Chen', kana: '', romaji: 'dchen' },
	{ name: 'Olivia Martinez', kana: '', romaji: 'omartinez' },
	{ name: 'Robert Green', kana: '', romaji: 'rgreen' },
	{ name: 'Jennifer Lee', kana: '', romaji: 'jlee' },
	{ name: 'William Turner', kana: '', romaji: 'wturner' },
	{ name: 'Amanda Foster', kana: '', romaji: 'afoster' },
	{ name: 'Christopher Reed', kana: '', romaji: 'creed' },
	{ name: 'Michelle Park', kana: '', romaji: 'mpark' },
	{ name: 'Daniel Wright', kana: '', romaji: 'dwright' },
	{ name: 'Laura Bennett', kana: '', romaji: 'lbennett' },
	{ name: 'Kevin Patel', kana: '', romaji: 'kpatel' },
	{ name: 'Sophia Nguyen', kana: '', romaji: 'snguyen' },
	{ name: 'Andrew Collins', kana: '', romaji: 'acollins' },
	{ name: 'Rachel Kim', kana: '', romaji: 'rkim' },
	{ name: 'Brian Sullivan', kana: '', romaji: 'bsullivan' },
	{ name: 'Jessica Ramirez', kana: '', romaji: 'jramirez' },
	{ name: 'Thomas Walsh', kana: '', romaji: 'twalsh' },
	{ name: 'Nicole Baker', kana: '', romaji: 'nbaker' },
	{ name: 'Steven Cooper', kana: '', romaji: 'scooper' },
	{ name: 'Karen Diaz', kana: '', romaji: 'kdiaz' }
];

type RoleDef = { role: string; department: string };

const rolePool: RoleDef[] = [
	{ role: 'President & CEO', department: 'Executive Office' },
	{ role: 'Director', department: 'Executive Office' },
	{ role: 'Sales Director', department: 'Sales' },
	{ role: 'Sales Manager', department: 'Sales' },
	{ role: 'Sales Representative', department: 'Sales' },
	{ role: 'Marketing Director', department: 'Marketing' },
	{ role: 'Procurement Specialist', department: 'Procurement' },
	{ role: 'General Affairs Manager', department: 'General Affairs' },
	{ role: 'IT Director', department: 'IT' },
	{ role: 'IT Specialist', department: 'IT' },
	{ role: 'Accounting Specialist', department: 'Accounting' },
	{ role: 'HR Specialist', department: 'Human Resources' },
	{ role: 'Manufacturing Manager', department: 'Manufacturing' },
	{ role: 'Product Planning Specialist', department: 'Product Planning' },
	{ role: 'PR Specialist', department: 'Public Relations' }
];

const dealTitles = [
	'Core System Implementation',
	'Website Renewal',
	'Sales Force Automation (SFA) Implementation',
	'Annual Maintenance Contract Renewal',
	'Cloud Migration Project',
	'Inventory Management System Overhaul',
	'E-Commerce Site Build',
	'Data Analytics Platform Build',
	'Internal Portal Development',
	'Security Hardening Initiative',
	'Mobile App Development',
	'Business Process Automation via RPA',
	'CRM Implementation',
	'Billing & Accounting System Integration',
	'Network Equipment Replacement',
	'BI Tool Implementation',
	'Applicant Tracking System Implementation',
	'Help Desk Outsourcing'
];

const dealNotesByStatus: Record<'open' | 'won' | 'lost', string[]> = {
	open: [
		'Proposal submitted; client is reviewing.',
		'Coordinating the next meeting.',
		'Waiting on budget approval.',
		'Comparing us against competitors.',
		'Additional requirements gathering planned.'
	],
	won: [
		'Deal won. Kickoff planned for next month.',
		'Contract signed. Preparing for delivery.',
		'Order confirmed. Working out details with the contact.'
	],
	lost: [
		'Passed due to budget constraints.',
		'Went with a competitor.',
		'Passed due to an internal policy change.'
	]
};

type ActivityTemplate = {
	type: 'note' | 'call' | 'email' | 'meeting';
	content: string;
};

// Activity history templates following a customer's deal progress (in chronological order)
const activitySequences: ActivityTemplate[][] = [
	// Pattern A: Email → Call → Visit → Proposal → Follow-up
	[
		{ type: 'email', content: 'Replied to the inquiry by email with a service overview attached.' },
		{ type: 'call', content: 'Called the contact to confirm current challenges and desired rollout timing. Scheduled an online meeting for next week.' },
		{ type: 'meeting', content: 'Ran an online demo. Contact praised the usability. Detailed requirements gathering planned for next time.' },
		{ type: 'email', content: 'Sent the proposal and quote. Expecting a response after internal review within two weeks.' },
		{ type: 'call', content: 'Follow-up call. Contact said it is "still with management for approval." Expected to hear back in early next month.' },
	],
	// Pattern B: Visit → Materials sent → Second visit → Price negotiation → Note
	[
		{ type: 'meeting', content: 'Initial visit. Met with the department head and the IT lead. Got a detailed picture of issues with their current system.' },
		{ type: 'email', content: 'Sent a summary of findings and a first-draft proposal.' },
		{ type: 'meeting', content: 'Visited to walk through the proposal using an ROI simulation. Fielded questions comparing us to competitors.' },
		{ type: 'call', content: 'Price negotiation call. They want the initial cost reduced. Will review internally and submit a revised quote.' },
		{ type: 'note', content: "Approval authority on their side tops out at the department head. Amounts over $50,000 require board sign-off." },
	],
	// Pattern C: Call → Email → Meeting → Note → Call
	[
		{ type: 'call', content: 'Cold call for new business. Contact was out; left a message. Came in through a referral after exchanging business cards.' },
		{ type: 'email', content: 'Sent a follow-up introducing the service, with a link to download materials.' },
		{ type: 'meeting', content: 'Held a requirements meeting. Strong need to digitize a schedule currently managed in spreadsheets. Taking the custom-table feasibility question back internally.' },
		{ type: 'note', content: 'Contact says they are also evaluating a competing no-code database tool. Usability and support seem to matter more to them than price.' },
		{ type: 'call', content: 'Called to confirm customization feasibility. Told them it is doable and will send a detailed spec sheet next week.' },
	],
	// Pattern D: Meeting → Note → Email → Call → Meeting
	[
		{ type: 'meeting', content: 'Follow-up visit after exchanging business cards at a trade show. Contact has a clear sense of their pain points and wants to move fast.' },
		{ type: 'note', content: 'Wants to go live before fiscal year end (March). Budget is already secured. Prioritizing speed.' },
		{ type: 'email', content: 'Sent a standard rollout schedule and an overview of initial setup support.' },
		{ type: 'call', content: 'Call to confirm timeline. Agreed to aim for signing by the middle of next month.' },
		{ type: 'meeting', content: 'Final review meeting before signing. They asked for help migrating existing CSV data as an add-on. Working out our approach.' },
	],
	// Pattern E: Email → Note → Call → Email → Note
	[
		{ type: 'email', content: 'Replied to a submission from the web contact form with a full set of materials.' },
		{ type: 'note', content: 'Inquiry: "Our current CRM is hard to use and we want to automate more with AI." Strong fit with their needs.' },
		{ type: 'call', content: 'First call with the contact. Very interested in AI chat-based operation. Scheduling a demo for next week.' },
		{ type: 'email', content: 'Sent a pre-demo questionnaire to confirm industry, company size, and current tools.' },
		{ type: 'note', content: 'Reviewed questionnaire responses. 15 users, currently running spreadsheets alongside another system. Concerned about migration cost.' },
	],
	// Pattern F: Call → Meeting → Note → Call → Email
	[
		{ type: 'call', content: 'Called on a referral from an existing customer. Contact had previously rolled out an SFA at another company, so the conversation moved fast.' },
		{ type: 'meeting', content: 'Ran an in-person demo. They were impressed by the AI dynamically generating forms. Committed on the spot to pitching it internally to leadership.' },
		{ type: 'note', content: 'Decision maker: IT Director (Sanders). Out of the country on business until next month, so no decision until then.' },
		{ type: 'call', content: 'Follow-up call after the director returned. Demo materials have been shared with the director. Expecting an answer next week.' },
		{ type: 'email', content: 'Sent an ROI worksheet and case studies again, as supporting material for the director.' },
	],
];

function generateActivitiesForCustomer(customerId: string, contactName: string, daysAgo: number): ActivitySeed[] {
	const sequence = pick(activitySequences);
	const count = randInt(4, 6);
	const selected = sequence.slice(0, count);

	return selected.map((tmpl, i) => {
		const daysOffset = daysAgo - Math.floor((daysAgo / count) * (count - 1 - i));
		const jitter = randInt(-3, 3);
		const createdAt = addDays(TODAY, -(daysOffset + jitter));
		return {
			id: crypto.randomUUID(),
			customerId,
			type: tmpl.type,
			content: tmpl.content,
			createdBy: '',
			createdAt: createdAt < TODAY ? createdAt : addDays(TODAY, -1)
		};
	});
}

export function generateSeedData(): SeedData {
	const customersOut: CustomerSeed[] = [];
	const contactsOut: ContactSeed[] = [];
	const dealsOut: DealSeed[] = [];
	const activitiesOut: ActivitySeed[] = [];

	for (const company of companies) {
		const customerId = crypto.randomUUID();
		customersOut.push({
			id: customerId,
			name: company.name,
			email: `info@${dummyEmailDomain(company.domain)}`,
			phone: company.phone,
			address: company.address,
			postalCode: company.postalCode,
			website: `https://${company.domain}`,
			status: company.status,
			notes: company.notes
		});

		const people = pickMany(peoplePool, randInt(1, 3));
		const primaryContact = people[0];
		for (const person of people) {
			const { role, department } = pick(rolePool);
			contactsOut.push({
				id: crypto.randomUUID(),
				customerId,
				name: person.name,
				nameKana: person.kana,
				email: `${person.romaji}@${dummyEmailDomain(company.domain)}`,
				phone: company.phone,
				role,
				department
			});
		}

		const daysAgo = randInt(30, 150);
		const acts = generateActivitiesForCustomer(customerId, primaryContact.name, daysAgo);
		activitiesOut.push(...acts);

		const titles = pickMany(dealTitles, randInt(3, 5));
		for (const title of titles) {
			const status: 'open' | 'won' | 'lost' = pick(['open', 'open', 'won', 'won', 'lost']);
			const amount = randInt(8, 300) * 100000;

			let plannedStart: Date;
			let plannedEnd: Date;
			let closedAt: Date | null = null;

			if (status === 'open') {
				plannedStart = addDays(TODAY, randInt(-60, 30));
				plannedEnd = addDays(plannedStart, randInt(30, 120));
			} else {
				plannedEnd = addDays(TODAY, -randInt(5, 90));
				plannedStart = addDays(plannedEnd, -randInt(30, 90));
				closedAt = addDays(plannedEnd, randInt(0, 3));
			}

			dealsOut.push({
				id: crypto.randomUUID(),
				customerId,
				title,
				amount,
				status,
				closedAt,
				plannedStart: fmtDate(plannedStart),
				plannedEnd: fmtDate(plannedEnd),
				notes: pick(dealNotesByStatus[status])
			});
		}
	}

	return { customers: customersOut, contacts: contactsOut, deals: dealsOut, activities: activitiesOut };
}
