<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StripePaymentService
{
    private string $secretKey;

    private string $apiBaseUrl;

    public function __construct()
    {
        $this->secretKey = (string) (config('services.stripe.secret') ?? env('STRIPE_SECRET_KEY', ''));
        $this->apiBaseUrl = 'https://api.stripe.com/v1';
    }

    /**
     * Cria um PaymentIntent na API do Stripe
     */
    public function createPaymentIntent(float $amount, string $currency = 'brl', array $metadata = []): array
    {
        $amountInCents = (int) round($amount * 100);

        if ($amountInCents <= 0) {
            throw new \InvalidArgumentException('O valor para cobrança nao Stripe deve ser maior que zero.');
        }

        if (empty($this->secretKey)) {
            throw new \RuntimeException('Chave secreta do Stripe não configurada.');
        }

        $params = [
            'amount' => $amountInCents,
            'currency' => strtolower($currency),
            'automatic_payment_methods[enabled]' => 'true',
        ];

        foreach ($metadata as $key => $value) {
            $params["metadata[{$key}]"] = (string) $value;
        }

        $response = Http::asForm()
            ->withToken($this->secretKey)
            ->post("{$this->apiBaseUrl}/payment_intents", $params);

        if (! $response->successful()) {
            Log::error('[StripePaymentService] Erro ao criar PaymentIntent', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            throw new \RuntimeException($response->json('error.message') ?? 'Erro ao comunicar com a Stripe.');
        }

        return $response->json();
    }

    /**
     * Consulta os detalhes de um PaymentIntent
     */
    public function retrievePaymentIntent(string $paymentIntentId): array
    {
        if (empty($this->secretKey)) {
            throw new \RuntimeException('Chave secreta do Stripe não configurada.');
        }

        $response = Http::withToken($this->secretKey)
            ->get("{$this->apiBaseUrl}/payment_intents/{$paymentIntentId}");

        if (! $response->successful()) {
            Log::error('[StripePaymentService] Erro ao consultar PaymentIntent', [
                'id' => $paymentIntentId,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            throw new \RuntimeException($response->json('error.message') ?? 'Erro ao consultar pagamento nao Stripe.');
        }

        return $response->json();
    }

    /**
     * Valida a assinatura criptográfica do Webhook da Stripe (HMAC SHA-256)
     */
    public function verifyWebhookSignature(string $payload, string $signatureHeader, ?string $secret = null): bool
    {
        $signingSecret = $secret ?? (string) (config('services.stripe.webhook_secret') ?? env('STRIPE_WEBHOOK_SECRET', ''));

        if (empty($signingSecret) || empty($signatureHeader)) {
            return false;
        }

        $timestamp = null;
        $signatures = [];

        foreach (explode(',', $signatureHeader) as $item) {
            $parts = explode('=', trim($item), 2);
            if (count($parts) === 2) {
                if ($parts[0] === 't') {
                    $timestamp = (int) $parts[1];
                } elseif ($parts[0] === 'v1') {
                    $signatures[] = $parts[1];
                }
            }
        }

        if (! $timestamp || empty($signatures)) {
            return false;
        }

        // Tolerância de 5 minutos contra replay attacks
        if (abs(time() - $timestamp) > 300) {
            return false;
        }

        $signedPayload = "{$timestamp}.{$payload}";
        $expectedSignature = hash_hmac('sha256', $signedPayload, $signingSecret);

        foreach ($signatures as $sig) {
            if (hash_equals($expectedSignature, $sig)) {
                return true;
            }
        }

        return false;
    }
}
