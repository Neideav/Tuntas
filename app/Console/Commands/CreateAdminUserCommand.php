<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminUserCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:create 
                            {--email= : The email address for the administrator}
                            {--name= : The full name of the administrator}
                            {--password= : The secure password (min 8 chars)}
                            {--role=admin : The user role (admin or instructor)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Provision or update an administrator account safely in production without demo seeders';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('Enter Administrator Email');
        $name = $this->option('name') ?: $this->ask('Enter Administrator Name', 'Administrator');
        $password = $this->option('password') ?: $this->secret('Enter Administrator Password (hidden)');
        $role = $this->option('role') ?: 'admin';

        // Validate Inputs
        $validator = Validator::make([
            'email' => $email,
            'name' => $name,
            'password' => $password,
            'role' => $role,
        ], [
            'email' => 'required|email|max:255',
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,instructor,student',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error("Validation error: {$error}");
            }
            return 1;
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            if (!$this->confirm("User with email [{$email}] already exists. Update role to [{$role}] and reset password?", true)) {
                $this->info('Operation cancelled.');
                return 0;
            }

            $user->update([
                'name' => $name,
                'password' => Hash::make($password),
                'role' => $role,
                'email_verified_at' => now(),
            ]);

            $this->info("✅ Administrator account [{$email}] updated successfully.");
        } else {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'role' => $role,
                'email_verified_at' => now(),
            ]);

            // Ensure settings exist
            UserSetting::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'theme' => 'dark',
                    'language' => 'id',
                    'notifications_enabled' => true,
                ]
            );

            $this->info("✅ Administrator account [{$email}] created successfully with role [{$role}].");
        }

        // Write audit log entry
        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'user.admin_provisioned',
            'auditable_type' => User::class,
            'auditable_id' => (string) $user->id,
            'payload' => [
                'email' => $user->email,
                'role' => $user->role,
                'provisioned_via' => 'cli',
            ],
            'created_at' => now(),
        ]);

        return 0;
    }
}
