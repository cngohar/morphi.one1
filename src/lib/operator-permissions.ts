export const permissions = {
	admin: [
		'games',
		'game-enable',
		'game-disable',
		'game-delete',
		'game-restore',
		'game-hard-delete',
		'users',
		'user-delete',
		'user-restore',
		'undo',
		'audit-export',
		'scoring',
		'themes',
		'dashboard',
		'status',
		'moderation',
		'queue',
		'audit',
		'privacy',
		'ranked',
		'hide',
		'restore',
		'ban',
		'unban',
		'rename',
		'case-add',
		'case-resolve',
		'export',
		'delete'
	],
	moderator: [
		'moderation',
		'queue',
		'hide',
		'restore',
		'ban',
		'unban',
		'rename',
		'case-add',
		'case-resolve'
	],
	support: ['moderation']
} as const;
export type OperatorRole = keyof typeof permissions;
export function can(role: string, action: string) {
	return (
		Object.hasOwn(permissions, role) &&
		(permissions[role as OperatorRole] as readonly string[]).includes(action)
	);
}
