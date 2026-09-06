<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use App\Services\BrevoMailService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateSuperAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'make:superadmin 
                            {email? : O e-mail do Super Administrador} 
                            {--password= : Senha de acesso (se omitida, será gerada aleatoriamente)}
                            {--name= : Nome do Super Administrador}';

    /**
     * The console command description.
     */
    protected $description = 'Cria ou redefine a senha de um Super Administrador com envio de credenciais por e-mail';

    /**
     * Execute the console command.
     */
    public function handle(BrevoMailService $brevoMailService): int
    {
        $email = $this->argument('email') ?? $this->ask('Qual o e-mail do Super Administrador?', env('SUPERADMIN_EMAIL', 'matheusneru@gmail.com'));
        $name = $this->option('name') ?? $this->ask('Qual o nome do Super Administrador?', 'Matheus Super Admin');

        $plainPassword = $this->option('password');
        if (empty($plainPassword)) {
            $plainPassword = Str::password(16);
            $this->info("Senha gerada aleatoriamente: {$plainPassword}");
        }

        $superAdminRole = Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Administrador Geral']);

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($plainPassword),
                'role_id' => $superAdminRole->id,
                'restaurant_id' => null,
            ]
        );

        $this->info("Super Admin [{$user->email}] configurado com sucesso no banco de dados.");

        // Disparar por Brevo
        $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000').'/login';
        $sent = $brevoMailService->sendSuperAdminCredentials($email, $plainPassword, $frontendUrl);

        if ($sent) {
            $this->info("E-mail com as credenciais enviado com sucesso para: {$email}");
        } else {
            $this->warn('Aviso: Falha no envio via Brevo. Guarde a senha exibida acima.');
        }

        return self::SUCCESS;
    }
}
