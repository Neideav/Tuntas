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
     * CLI password option is strictly omitted to prevent credential leaks in shell history and process tables.
     *
     * @var string
     */
    protected $signature = 'admin:create 
                            {--email= : The email address for the administrator}
                            {--name= : The full name of the administrator}
                            {--role=admin : The user role (admin or instructor)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Provision or update an administrator account safely in production with hidden password input';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('Enter Administrator Email');
        $name = $this->option('name') ?: $this->ask('Enter Administrator Name', 'Administrator');
        $role = $this->option('role') ?: 'admin';

        // Hidden password prompt and confirmation
        $password = $this->secret('Enter Administrator Password (hidden, min 8 chars)');
        $confirm = $this->secret('Confirm Administrator Password');

        if ($password !== $confirm) {
            $this->error('❌ Passwords do not match.');
            return 1;
        }

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
            // Require explicit confirmation to modify existing account
            if (!$this->confirm("User with email [{$email}] already exists. Update role to [{$role}] and reset password?", false)) {
                $this->info('Operation cancelled. Existing account was left unchanged.');
                return 0;
            }

            $user->update([
                'name' => $name,
                'password' => Hash::make($password),
                'role' => $role,
                'email_verified_at' => now(),
            ]);

            UserSetting::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'theme' => 'dark',
                    'email_notifications' => true,
                    'in_app_notifications' => true,
                    'daily_digest' => true,
                    'timezone' => $user->timezone ?? 'Asia/Jakarta',
                    'preferences' => [],
                ]
            );

            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'user.admin_updated',
                'auditable_type' => User::class,
                'auditable_id' => (string) $user->id,
                'payload' => [
                    'email' => $user->email,
                    'role' => $user->role,
                    'action_type' => 'password_reset_and_role_update',
                ],
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Artisan CLI',
                'created_at' => now(),
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
                    'email_notifications' => true,
                    'in_app_notifications' => true,
                    'daily_digest' => true,
                    'timezone' => 'Asia/Jakarta',
                    'preferences' => [],
                ]
            );

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
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Artisan CLI',
                'created_at' => now(),
            ]);

            $this->info("✅ Administrator account [{$email}] created successfully with role [{$role}].");
        }

        return 0;
    }
}
