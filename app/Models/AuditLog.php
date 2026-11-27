<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'actor_id',
        'action',
        'auditable_type',
        'auditable_id',
        'resource_type',
        'resource_id',
        'context_type',
        'context_id',
        'project_id',
        'old_values',
        'new_values',
        'metadata',
        'payload',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'old_values'  => 'array',
        'new_values'  => 'array',
        'metadata'    => 'array',
        'payload'     => 'array',
        'created_at'  => 'datetime',
    ];

    /**
     * The actor (user) who performed the action.
     */
    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * Backward-compatible relation to User.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Associated project (if any).
     */
    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /**
     * Polymorphic relation to resource.
     */
    public function auditable()
    {
        return $this->morphTo();
    }

    /**
     * Static helper method for logging with automatic payload & attribute mapping.
     */
    public static function log(
        ?int $userId,
        string $action,
        ?string $description = null,
        ?int $projectId = null,
        ?array $payload = null,
        ?Model $auditable = null
    ): self {
        $actorId = $userId ?? auth()->id() ?? 1;

        $auditableType = $auditable
            ? get_class($auditable)
            : (isset($payload['report_id']) ? WorkReport::class : User::class);
        $auditableId = $auditable
            ? (string) $auditable->getKey()
            : (string) ($payload['report_id'] ?? $payload['task_id'] ?? $payload['note_id'] ?? $userId ?? '0');

        $resourceType = $auditable ? class_basename($auditable) : null;
        $resourceId = $auditableId;

        $fullPayload = array_merge(
            $payload ?? [],
            $description ? ['description' => $description] : [],
            $projectId ? ['project_id' => $projectId] : []
        );

        return self::create([
            'user_id'        => $actorId,
            'actor_id'       => $actorId,
            'action'         => $action,
            'auditable_type' => $auditableType,
            'auditable_id'   => $auditableId,
            'resource_type'  => $resourceType,
            'resource_id'    => $resourceId,
            'context_type'   => $projectId ? 'project' : 'workspace',
            'context_id'     => $projectId,
            'project_id'     => $projectId,
            'payload'        => $fullPayload,
            'metadata'       => $description ? ['description' => $description] : null,
            'ip_address'     => request()?->ip() ?? '127.0.0.1',
            'user_agent'     => request()?->userAgent() ?? 'System',
            'created_at'     => now(),
        ]);
    }
}
