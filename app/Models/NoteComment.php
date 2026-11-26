<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NoteComment extends Model
{
    use HasFactory;

    protected $fillable = [
        'note_id',
        'user_id',
        'parent_id',
        'content',
    ];

    public function note()
    {
        return $this->belongsTo(Note::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(self::class, 'parent_id')->with(['user:id,name,email', 'replies']);
    }

    public function mentions()
    {
        return $this->morphMany(Mention::class, 'mentionable');
    }
}
