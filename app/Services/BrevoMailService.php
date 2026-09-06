<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BrevoMailService
{
    /**
     * Dispara e-mail com as credenciais do Super Admin via API v3 do Brevo
     */
    public function sendSuperAdminCredentials(string $adminEmail, string $plainPassword, string $loginUrl): bool
    {
        $apiKey = config('services.brevo.key') ?? env('BREVO_API_KEY');
        $senderEmail = config('mail.from.address') ?? env('MAIL_FROM_ADDRESS', 'matheusneru@gmail.com');
        $senderName = config('mail.from.name') ?? env('MAIL_FROM_NAME', 'ELO Gastronomia');

        if (empty($apiKey)) {
            Log::warning('[BrevoMailService] Chave de API do Brevo não configurada.');

            return false;
        }

        $htmlContent = "
        <div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #121110; color: #EDE8E1; padding: 32px; border-radius: 12px; border: 1px solid #2B2824;\">
            <div style=\"text-align: center; margin-bottom: 24px;\">
                <h1 style=\"color: #FAF8F5; font-size: 24px; margin: 0 0 8px 0; font-weight: 600;\">ELO Gastronomia</h1>
                <p style=\"color: #8A8278; font-size: 13px; margin: 0;\">Acesso Super Administrador</p>
            </div>
            
            <p style=\"font-size: 14px; line-height: 1.6; color: #D4CDC5;\">
                Sua conta de <strong>Super Administrador</strong> foi inicializada com sucesso na plataforma.
            </p>

            <div style=\"background-color: #1A1816; border: 1px solid #3A3530; border-radius: 8px; padding: 16px; margin: 20px 0;\">
                <p style=\"margin: 0 0 8px 0; font-size: 13px; color: #FAF8F5;\">
                    <strong>E-mail de acesso:</strong> <span style=\"color: #C84E1F;\">{$adminEmail}</span>
                </p>
                <p style=\"margin: 0; font-size: 13px; color: #FAF8F5;\">
                    <strong>Senha de acesso:</strong> <code style=\"background-color: #242220; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #FAF8F5; font-weight: bold;\">{$plainPassword}</code>
                </p>
            </div>

            <p style=\"font-size: 12px; color: #8A8278; line-height: 1.5;\">
                Esta senha foi gerada dinamicamente pelo seeder para garantir total segurança da sua infraestrutura.
            </p>

            <div style=\"text-align: center; margin: 28px 0;\">
                <a href=\"{$loginUrl}\" style=\"background-color: #C84E1F; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 500; font-size: 13px; display: inline-block;\">
                    Acessar Painel ELO
                </a>
            </div>

            <div style=\"border-top: 1px solid #262320; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #635D55; text-align: center;\">
                ELO Platform • Acesso Seguro e Monitorado
            </div>
        </div>
        ";

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'api-key' => $apiKey,
                'accept' => 'application/json',
                'content-type' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                'sender' => [
                    'name' => $senderName,
                    'email' => $senderEmail,
                ],
                'to' => [
                    [
                        'email' => $adminEmail,
                        'name' => 'Super Admin',
                    ],
                ],
                'subject' => 'ELO Gastronomia • Suas Credenciais de Super Administrador',
                'htmlContent' => $htmlContent,
            ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('[BrevoMailService] Falha no disparo via API Brevo: '.$response->body());

            return false;
        } catch (\Throwable $e) {
            Log::error('[BrevoMailService] Exceção ao conectar à API Brevo: '.$e->getMessage());

            return false;
        }
    }
}
