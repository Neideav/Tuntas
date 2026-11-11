<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExaminationPreparation extends Model
{
    use HasFactory;

    protected $fillable = [
        'examination_id',
        'title',
        'is_completed',
        'due_date',
        'order',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'due_date' => 'date',
        'order' => 'integer',
    ];

    public function examination()
    {
        return $this->belongsTo(Examination::class);
    }
}

