CREATE TABLE `email_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`customer_id` text,
	`account_id` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`error_message` text,
	`source` text DEFAULT 'chat' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
