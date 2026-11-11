<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'category_id',
        'title',
        'description',
        'status',
        'priority',
        'progress',
        'start_date',
        'deadline',
    ];

    protected $casts = [
        'start_date' => 'date',
        'deadline' => 'date',
        'progress' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function tags()
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }

    /**
     * Recalculate and update progress based on linked tasks.
     */
    public function updateProgress(): void
    {
        $total = $this->tasks()->count();
        if ($total === 0) {
            $this->update(['progress' => 0]);
            return;
        }

        $completed = $this->tasks()->where('status', 'completed')->count();
        $this->update(['progress' => (int) round(($completed / $total) * 100)]);
    }
}

