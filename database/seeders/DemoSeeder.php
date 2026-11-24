<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    /**
     * Run the demo mock seeders explicitly.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            TuntasPlatformSeeder::class,
        ]);
    }
}
