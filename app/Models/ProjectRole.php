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

    /**
     * Centralized Permission Catalog.
     */
    public const PERMISSION_CATALOG = [
        'project' => [
            'title' => 'Project',
            'permissions' => [
                'project.view' => [
                    'label' => 'View Project',
                    'description' => 'Can view project details, milestones, overview, and statistics.',
                ],
                'project.update' => [
                    'label' => 'Update Project',
                    'description' => 'Can update project properties, deadlines, health, and milestones.',
                ],
                'project.archive' => [
                    'label' => 'Archive Project',
                    'description' => 'Can archive and unarchive the project.',
                ],
                'project.delete' => [
                    'label' => 'Delete Project',
                    'description' => 'Can permanently delete the project (Owner privilege).',
                    'protected' => true,
                ],
            ],
        ],
        'members' => [
            'title' => 'Members',
            'permissions' => [
                'members.view' => [
                    'label' => 'View Members',
                    'description' => 'Can see the list of team members, roles, and pending invitations.',
                ],
                'members.invite' => [
                    'label' => 'Invite Members',
                    'description' => 'Can generate invitation links and invite new team members.',
                ],
                'members.remove' => [
                    'label' => 'Remove Members',
                    'description' => 'Can remove members from the project.',
                ],
                'members.manage' => [
                    'label' => 'Manage Member Roles',
                    'description' => 'Can assign, change, and update member roles.',
                ],
            ],
        ],
        'roles' => [
            'title' => 'Roles',
            'permissions' => [
                'roles.view' => [
                    'label' => 'View Roles',
                    'description' => 'Can view project roles and their granted permissions.',
                ],
                'roles.create' => [
                    'label' => 'Create Roles',
                    'description' => 'Can define new custom roles for the project.',
                ],
                'roles.update' => [
                    'label' => 'Update Roles',
                    'description' => 'Can edit custom role details, names, colors, and permissions.',
                ],
                'roles.delete' => [
                    'label' => 'Delete Roles',
                    'description' => 'Can remove unused custom roles from the project.',
                ],
                'roles.manage' => [
                    'label' => 'Manage Role Permissions',
                    'description' => 'Can adjust permission matrices for custom roles.',
                ],
            ],
        ],
        'tasks' => [
            'title' => 'Tasks',
            'permissions' => [
                'tasks.view' => [
                    'label' => 'View Tasks',
                    'description' => 'Can view tasks, subtasks, and dependencies in the project.',
                ],
                'tasks.create' => [
                    'label' => 'Create Tasks',
                    'description' => 'Can create new tasks within the project.',
                ],
                'tasks.update' => [
                    'label' => 'Update Tasks',
                    'description' => 'Can edit task details, priority, deadlines, and properties.',
                ],
                'tasks.assign' => [
                    'label' => 'Assign Tasks',
                    'description' => 'Can assign team members to tasks.',
                ],
                'tasks.complete' => [
                    'label' => 'Complete Tasks',
                    'description' => 'Can change status and mark tasks complete.',
                ],
                'tasks.delete' => [
                    'label' => 'Delete Tasks',
                    'description' => 'Can delete tasks from the project.',
                ],
            ],
        ],
        'notes' => [
            'title' => 'Notes',
            'permissions' => [
                'notes.view' => [
                    'label' => 'View Notes',
                    'description' => 'Can read project notes and documentation.',
                ],
                'notes.create' => [
                    'label' => 'Create Notes',
                    'description' => 'Can author new project notes.',
                ],
                'notes.update' => [
                    'label' => 'Update Notes',
                    'description' => 'Can edit existing project notes.',
                ],
                'notes.delete' => [
                    'label' => 'Delete Notes',
                    'description' => 'Can remove project notes.',
                ],
                'notes.pin' => [
                    'label' => 'Pin Notes',
                    'description' => 'Can pin or unpin notes at the top of the project.',
                ],
            ],
        ],
        'reports' => [
            'title' => 'Reports',
            'permissions' => [
                'reports.view' => [
                    'label' => 'View Reports',
                    'description' => 'Can view submitted work reports and review histories.',
                ],
                'reports.submit' => [
                    'label' => 'Submit Reports',
                    'description' => 'Can draft and submit work reports for review.',
                ],
                'reports.review' => [
                    'label' => 'Review Reports',
                    'description' => 'Can review submitted work reports.',
                ],
                'reports.approve' => [
                    'label' => 'Approve Reports',
                    'description' => 'Can approve work reports (does not auto-complete tasks).',
                ],
                'reports.request_revision' => [
                    'label' => 'Request Revision',
                    'description' => 'Can request revisions on submitted work reports.',
                ],
            ],
        ],
    ];

    /**
     * Flattened array of all valid permissions.
     */
    public static function allPermissionKeys(): array
    {
        $keys = [];
        foreach (self::PERMISSION_CATALOG as $group) {
            foreach (array_keys($group['permissions']) as $key) {
                $keys[] = $key;
            }
        }
        return $keys;
    }

    protected $fillable = [
        'project_id',
        'name',
        'slug',
        'description',
        'color',
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
        // Owner has wildcard access to all permissions
        if ($this->slug === self::ROLE_OWNER) {
            return true;
        }

        $perms = $this->permissions ?? [];
        if (in_array('*', $perms, true)) {
            return true;
        }

        // Support both dot-notation and colon-notation seamlessly
        $normalized = str_replace(':', '.', $permission);
        $colonVariant = str_replace('.', ':', $permission);

        return in_array($permission, $perms, true)
            || in_array($normalized, $perms, true)
            || in_array($colonVariant, $perms, true);
    }

    /**
     * Get default permissions for built-in roles.
     */
    public static function getDefaultPermissions(string $roleSlug): array
    {
        return match ($roleSlug) {
            self::ROLE_OWNER => ['*'],
            self::ROLE_ADMIN => [
                'project.view', 'project.update', 'project.archive',
                'members.view', 'members.invite', 'members.remove', 'members.manage',
                'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.manage',
                'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.complete', 'tasks.delete',
                'notes.view', 'notes.create', 'notes.update', 'notes.delete', 'notes.pin',
                'reports.view', 'reports.submit', 'reports.review', 'reports.approve', 'reports.request_revision',
            ],
            self::ROLE_MEMBER => [
                'project.view',
                'members.view',
                'roles.view',
                'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.complete',
                'notes.view', 'notes.create', 'notes.update',
                'reports.view', 'reports.submit',
            ],
            self::ROLE_VIEWER => [
                'project.view',
                'members.view',
                'roles.view',
                'tasks.view',
                'notes.view',
                'reports.view',
            ],
            default => ['project.view', 'tasks.view', 'notes.view', 'reports.view'],
        };
    }

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
                'description' => 'Full administrative control over project, members, roles, and settings.',
                'color' => '#6366F1', // Indigo
            ],
            self::ROLE_ADMIN => [
                'name' => 'Admin',
                'description' => 'Can manage tasks, notes, reports, and team members.',
                'color' => '#0EA5E9', // Sky
            ],
            self::ROLE_MEMBER => [
                'name' => 'Member',
                'description' => 'Can create and manage tasks, notes, and submit work reports.',
                'color' => '#10B981', // Emerald
            ],
            self::ROLE_VIEWER => [
                'name' => 'Viewer',
                'description' => 'Read-only access to view project tasks, notes, and reports.',
                'color' => '#64748B', // Slate
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
                    'color' => $data['color'],
                    'is_builtin' => true,
                    'permissions' => self::getDefaultPermissions($slug),
                ]
            );
        }

        return $roles;
    }
}
