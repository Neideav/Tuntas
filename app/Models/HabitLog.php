<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HabitLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'habit_id',
        'user_id',
        'log_date',
        'value',
        'is_completed',
        'used_freeze',
        'notes',
    ];

    protected $casts = [
        'log_date' => 'date',
        'value' => 'integer',
        'is_completed' => 'boolean',
        'used_freeze' => 'boolean',
    ];

    public function habit()
    {
        return $this->belongsTo(Habit::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

