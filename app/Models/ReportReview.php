<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReportReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'work_report_id',
        'reviewer_id',
        'status',
        'feedback',
        'version',
    ];

    protected $casts = [
        'version' => 'integer',
    ];

    public function workReport()
    {
        return $this->belongsTo(WorkReport::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
