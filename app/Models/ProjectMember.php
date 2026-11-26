<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'user_id',
        'role_id',
        'role',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function projectRole()
    {
        return $this->belongsTo(ProjectRole::class, 'role_id');
    }

    /**
     * Check if member has a specific permission in the project.
     */
    public function hasPermission(string $permission): bool
    {
        // Project creator/owner always has all permissions
        if ($this->role === ProjectRole::ROLE_OWNER) {
            return true;
        }

        if ($this->projectRole) {
            return $this->projectRole->hasPermission($permission);
        }

        // Fallback to default permissions by role slug
        $defaultPerms = ProjectRole::getDefaultPermissions($this->role);
        return in_array('*', $defaultPerms, true) || in_array($permission, $defaultPerms, true);
    }
}
