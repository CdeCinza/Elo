<x-mail::message>
# Acesso Super Administrador

Sua conta de Super Administrador foi criada e inicializada com sucesso na plataforma **ELO Gastronomia**.

<x-mail::panel>
**E-mail de acesso:** `{{ $adminEmail }}`  
**Senha gerada:** `{{ $plainPassword }}`
</x-mail::panel>

Esta senha foi gerada dinamicamente de forma segura durante a inicialização do sistema para evitar senhas expostas no código.

<x-mail::button :url="$loginUrl">
Acessar Painel ELO
</x-mail::button>

> **Recomendação de Segurança:** Não compartilhe estas credenciais e altere sua senha caso deseje após o primeiro acesso.

Atenciosamente,<br>
Equipe {{ config('app.name', 'ELO Gastronomia') }}
</x-mail::message>
