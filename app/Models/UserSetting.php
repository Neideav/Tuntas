<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'theme',
        'email_notifications',
        'in_app_notifications',
        'daily_digest',
        'timezone',
        'preferences',
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'in_app_notifications' => 'boolean',
        'daily_digest' => 'boolean',
        'preferences' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

