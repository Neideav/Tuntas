<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Mention extends Model
{
    use HasFactory;

    protected $fillable = [
        'mentioner_id',
        'mentioned_user_id',
        'mentioned_role_id',
        'mentionable_type',
        'mentionable_id',
        'project_id',
    ];

    public function mentioner()
    {
        return $this->belongsTo(User::class, 'mentioner_id');
    }

    public function mentionedUser()
    {
        return $this->belongsTo(User::class, 'mentioned_user_id');
    }

    public function mentionedRole()
    {
        return $this->belongsTo(ProjectRole::class, 'mentioned_role_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function mentionable()
    {
        return $this->morphTo();
    }
}
