<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'timezone',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function projects()
    {
        return $this->hasMany(Project::class);
    }

    public function examinations()
    {
        return $this->hasMany(Examination::class);
    }

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function settings()
    {
        return $this->hasOne(UserSetting::class);
    }

    public function habits()
    {
        return $this->hasMany(Habit::class);
    }

    public function goals()
    {
        return $this->hasMany(Goal::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }

    public function learningSessions()
    {
        return $this->hasMany(LearningSession::class);
    }

    public function questionBanks()
    {
        return $this->hasMany(QuestionBank::class);
    }

    public function examBlueprints()
    {
        return $this->hasMany(ExamBlueprint::class);
    }

    public function examAttempts()
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
