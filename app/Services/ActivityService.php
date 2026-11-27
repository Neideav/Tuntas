<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

class ActivityService
{
    /**
     * Sensitive keys that must be stripped or redacted from logs.
     */
    protected const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'token',
        'access_token',
        'remember_token',
        'secret',
        'api_key',
        'card_number',
        'cvv',
        'credentials',
        'content', // avoid leaking entire private note or report content
    ];

    /**
     * Record an activity/audit log with security redaction, actor attribution,
     * contextual validation, and historical delta tracking.
     */
    public function record(
        string $action,
        ?Model $resource = null,
        ?User $actor = null,
        ?string $contextType = null,
        ?int $contextId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?array $metadata = null,
        ?int $projectId = null
    ): AuditLog {
        $actorId = $actor ? $actor->id : (auth()->id() ?? 1);

        $auditableType = $resource ? get_class($resource) : null;
        $auditableId = $resource ? (string) $resource->getKey() : null;
        $resourceType = $resource ? class_basename($resource) : null;

        // Auto-resolve project ID if available on the resource
        if (!$projectId && $resource && isset($resource->project_id)) {
            $projectId = $resource->project_id;
        }

        // Auto-resolve context if not explicitly provided
        if (!$contextType) {
            $contextType = $projectId ? 'project' : 'workspace';
            $contextId = $projectId;
        }

        $cleanOldValues = $oldValues ? $this->sanitizeData($oldValues) : null;
        $cleanNewValues = $newValues ? $this->sanitizeData($newValues) : null;
        $cleanMetadata = $metadata ? $this->sanitizeData($metadata) : null;

        // Duplicate prevention: avoid identical log within 2 seconds
        $existing = AuditLog::where('actor_id', $actorId)
            ->where('action', $action)
            ->where('auditable_type', $auditableType)
            ->where('auditable_id', $auditableId)
            ->where('created_at', '>=', now()->subSeconds(2))
            ->first();

        if ($existing) {
            return $existing;
        }

        return AuditLog::create([
            'user_id'        => $actorId,
            'actor_id'       => $actorId,
            'action'         => $action,
            'auditable_type' => $auditableType ?? User::class,
            'auditable_id'   => $auditableId ?? (string) $actorId,
            'resource_type'  => $resourceType,
            'resource_id'    => $auditableId,
            'context_type'   => $contextType,
            'context_id'     => $contextId,
            'project_id'     => $projectId,
            'old_values'     => $cleanOldValues,
            'new_values'     => $cleanNewValues,
            'metadata'       => $cleanMetadata,
            'payload'        => array_filter([
                'description' => $cleanMetadata['description'] ?? null,
                'resource'    => $resourceType,
                'old'         => $cleanOldValues,
                'new'         => $cleanNewValues,
            ]),
            'ip_address'     => Request::ip() ?? '127.0.0.1',
            'user_agent'     => Request::userAgent() ?? 'System',
            'created_at'     => now(),
        ]);
    }

    /**
     * Recursively sanitize sensitive information from data arrays.
     */
    public function sanitizeData(array $data): array
    {
        $sanitized = [];

        foreach ($data as $key => $value) {
            $normalizedKey = strtolower((string) $key);

            if (in_array($normalizedKey, self::SENSITIVE_KEYS, true)) {
                $sanitized[$key] = '[REDACTED]';
                continue;
            }

            if (is_array($value)) {
                $sanitized[$key] = $this->sanitizeData($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    /**
     * Check if a user is authorized to view audit logs for a given project or context.
     */
    public function canViewProjectActivity(User $user, Project $project): bool
    {
        if ($project->user_id === $user->id) {
            return true;
        }

        return ProjectMember::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->exists();
    }
}
