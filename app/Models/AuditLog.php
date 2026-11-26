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
        'action',
        'auditable_type',
        'auditable_id',
        'payload',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function auditable()
    {
        return $this->morphTo();
    }

    public static function log(
        ?int $userId,
        string $action,
        ?string $description = null,
        ?int $projectId = null,
        ?array $payload = null,
        ?Model $auditable = null
    ): self {
        $auditableType = $auditable ? get_class($auditable) : (isset($payload['report_id']) ? WorkReport::class : User::class);
        $auditableId = $auditable ? (string) $auditable->getKey() : (string) ($payload['report_id'] ?? $userId ?? '0');

        $fullPayload = array_merge(
            $payload ?? [],
            $description ? ['description' => $description] : [],
            $projectId ? ['project_id' => $projectId] : []
        );

        return self::create([
            'user_id' => $userId ?? 1,
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'payload' => $fullPayload,
            'ip_address' => request()?->ip() ?? '127.0.0.1',
            'user_agent' => request()?->userAgent() ?? 'System',
            'created_at' => now(),
        ]);
    }
}

