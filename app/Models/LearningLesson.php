<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LearningLesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'module_id',
        'title',
        'content',
        'resource_url',
        'duration_minutes',
        'order',
        'is_completed',
        'completed_at',
    ];

    protected $casts = [
        'duration_minutes' => 'integer',
        'order' => 'integer',
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function module()
    {
        return $this->belongsTo(LearningModule::class, 'module_id');
    }
}
