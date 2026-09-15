// A signal that resets the chat screen's state when "New chat" is clicked.
// +page.svelte holds client-side in-memory state, so navigating to the same "/" route
// doesn't reset it automatically — SvelteKit reuses the component instance.
class ChatSessionStore {
	resetToken = $state(0);

	startNew() {
		this.resetToken++;
	}
}

export const chatSession = new ChatSessionStore();
