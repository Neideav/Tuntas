<?php

namespace App\Events;

use App\Models\ProjectRole;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoleMentioned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly User        $mentionedUser,
        public readonly User        $mentioner,
        public readonly ProjectRole $role,
        public readonly string      $contextType,
        public readonly int         $contextId,
        public readonly string      $contextTitle,
        public readonly int         $projectId,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->mentionedUser->id}")];
    }

    public function broadcastAs(): string
    {
        return 'mention.role';
    }

    public function broadcastWith(): array
    {
        return [
            'type'          => 'role_mentioned',
            'mentioner'     => ['id' => $this->mentioner->id, 'name' => $this->mentioner->name],
            'role'          => ['id' => $this->role->id, 'name' => $this->role->name, 'color' => $this->role->color],
            'context_type'  => $this->contextType,
            'context_id'    => $this->contextId,
            'context_title' => $this->contextTitle,
            'project_id'    => $this->projectId,
        ];
    }
}
