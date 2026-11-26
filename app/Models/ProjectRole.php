<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectRole extends Model
{
    use HasFactory;

    public const ROLE_OWNER = 'owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_MEMBER = 'member';
    public const ROLE_VIEWER = 'viewer';

    public const BUILTIN_ROLES = [
        self::ROLE_OWNER,
        self::ROLE_ADMIN,
        self::ROLE_MEMBER,
        self::ROLE_VIEWER,
    ];

    public const ALL_PERMISSIONS = [
        // Project
        'project:view',
        'project:edit',
        'project:delete',
        'project:manage_members',
        'project:manage_roles',
        'project:archive',

        // Tasks
        'task:view',
        'task:create',
        'task:edit',
        'task:delete',
        'task:assign',
        'task:complete',

        // Notes
        'note:view',
        'note:create',
        'note:edit',
        'note:delete',

        // Reports
        'report:view',
        'report:create',
        'report:review',
        'report:approve',

        // Milestones
        'milestone:manage',
    ];

    protected $fillable = [
        'project_id',
        'name',
        'slug',
        'description',
        'is_builtin',
        'permissions',
    ];

    protected $casts = [
        'is_builtin' => 'boolean',
        'permissions' => 'array',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function members()
    {
        return $this->hasMany(ProjectMember::class, 'role_id');
    }

    public function invitations()
    {
        return $this->hasMany(ProjectInvitation::class, 'role_id');
    }

    /**
     * Check if this role grants a specific permission.
     */
    public function hasPermission(string $permission): bool
    {
        if ($this->slug === self::ROLE_OWNER) {
            return true;
        }

        $perms = $this->permissions ?? [];
        return in_array('*', $perms, true) || in_array($permission, $perms, true);
    }

    /**
     * Get default permissions for built-in roles.
     */
    public static function getDefaultPermissions(string $roleSlug): array
    {
        return match ($roleSlug) {
            self::ROLE_OWNER => ['*'],
            self::ROLE_ADMIN => [
                'project:view', 'project:edit', 'project:manage_members', 'project:manage_roles', 'project:archive',
                'task:view', 'task:create', 'task:edit', 'task:delete', 'task:assign', 'task:complete',
                'note:view', 'note:create', 'note:edit', 'note:delete',
                'report:view', 'report:create', 'report:review', 'report:approve',
                'milestone:manage',
            ],
            self::ROLE_MEMBER => [
                'project:view',
                'task:view', 'task:create', 'task:edit', 'task:complete',
                'note:view', 'note:create', 'note:edit',
                'report:view', 'report:create',
            ],
            self::ROLE_VIEWER => [
                'project:view',
                'task:view',
                'note:view',
                'report:view',
            ],
    /**
     * Ensure all built-in roles exist for a given project.
     *
     * @return array<string, ProjectRole>
     */
    public static function ensureBuiltinRolesForProject(Project $project): array
    {
        $roles = [];
        $definitions = [
            self::ROLE_OWNER => [
                'name' => 'Owner',
                'description' => 'Full administrative access to project and all resources.',
            ],
            self::ROLE_ADMIN => [
                'name' => 'Admin',
                'description' => 'Can manage tasks, notes, reports, and invite members.',
            ],
            self::ROLE_MEMBER => [
                'name' => 'Member',
                'description' => 'Can create and manage tasks, notes, and work reports.',
            ],
            self::ROLE_VIEWER => [
                'name' => 'Viewer',
                'description' => 'Read-only access to project resources.',
            ],
        ];

        foreach ($definitions as $slug => $data) {
            $roles[$slug] = self::firstOrCreate(
                [
                    'project_id' => $project->id,
                    'slug' => $slug,
                ],
                [
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'is_builtin' => true,
                    'permissions' => self::getDefaultPermissions($slug),
                ]
            );
        }

        return $roles;
    }
}
