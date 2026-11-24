<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     * In production, demo accounts and mock data are strictly prohibited.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command->warn('⚠️ Production environment detected: Demo accounts and mock seeders are disabled.');
            $this->command->info('👉 To provision an administrator safely in production, run: php artisan admin:create');
            return;
        }

        $this->call([
            DemoSeeder::class,
        ]);
    }
}
