import type { PageServerLoad } from './$types';
import { config } from '$lib/server/config';
import { listVisible, countVisible } from '$lib/server/gallery';

export const load: PageServerLoad = async () => {
	return {
		event: {
			title: config.eventTitle,
			subtitle: config.eventSubtitle
		},
		limits: {
			imageMb: Math.round(config.limits.imageBytes / (1024 * 1024)),
			videoMb: Math.round(config.limits.videoBytes / (1024 * 1024))
		},
		items: listVisible(40),
		total: countVisible()
	};
};
