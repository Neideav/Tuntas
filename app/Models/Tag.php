<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'color',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function tasks()
    {
        return $this->morphedByMany(Task::class, 'taggable');
    }

    public function projects()
    {
        return $this->morphedByMany(Project::class, 'taggable');
    }

    public function examinations()
    {
        return $this->morphedByMany(Examination::class, 'taggable');
    }
}

