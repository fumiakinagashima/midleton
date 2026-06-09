import adapter from '@sveltejs/adapter-cloudflare';
import { preprocessor } from './node_modules/@inlang/paraglide-sveltekit/dist/vite/preprocessor/index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [preprocessor({})],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			platformProxy: {
				enabled: true,
				persist: { path: '.wrangler/state/v3' }
			}
		})
	}
};

export default config;
