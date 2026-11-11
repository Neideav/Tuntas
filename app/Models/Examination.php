<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Examination extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'category_id',
        'title',
        'description',
        'subject',
        'examination_date',
        'start_time',
        'end_time',
        'duration_minutes',
        'location_platform',
        'status',
        'notes',
        'related_materials',
        'score',
        'passing_score',
    ];

    protected $casts = [
        'examination_date' => 'date',
        'duration_minutes' => 'integer',
        'score' => 'decimal:2',
        'passing_score' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function preparations()
    {
        return $this->hasMany(ExaminationPreparation::class)->orderBy('order');
    }

    public function tags()
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }
}

