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
        if (!Schema::hasColumn('project_roles', 'color')) {
            Schema::table('project_roles', function (Blueprint $table) {
                $table->string('color', 30)->default('#6366F1')->after('description');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('project_roles', 'color')) {
            Schema::table('project_roles', function (Blueprint $table) {
                $table->dropColumn('color');
            });
        }
    }
};
