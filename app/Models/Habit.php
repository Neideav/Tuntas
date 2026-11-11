<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Habit extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'frequency',
        'target_count',
        'unit',
        'color',
        'icon',
        'current_streak',
        'best_streak',
        'freeze_tokens',
        'is_archived',
    ];

    protected $casts = [
        'target_count' => 'integer',
        'current_streak' => 'integer',
        'best_streak' => 'integer',
        'freeze_tokens' => 'integer',
        'is_archived' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function logs()
    {
        return $this->hasMany(HabitLog::class);
    }
}

