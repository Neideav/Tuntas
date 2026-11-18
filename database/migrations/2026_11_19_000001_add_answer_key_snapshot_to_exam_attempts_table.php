<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('exam_attempts') && !Schema::hasColumn('exam_attempts', 'answer_key_snapshot')) {
            Schema::table('exam_attempts', function (Blueprint $table) {
                $table->json('answer_key_snapshot')->nullable()->after('questions_snapshot');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('exam_attempts') && Schema::hasColumn('exam_attempts', 'answer_key_snapshot')) {
            Schema::table('exam_attempts', function (Blueprint $table) {
                $table->dropColumn('answer_key_snapshot');
            });
        }
    }
};
