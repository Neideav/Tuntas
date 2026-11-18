<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'title',
        'description',
        'due_date',
        'is_completed',
        'order',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'due_date' => 'date',
        'order' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
