from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from core.models import Profile


class SignUpForm(UserCreationForm):
    """
    Cadastro de usuário comum. NÃO cria conta de staff/admin — contas
    administrativas são criadas apenas via `python manage.py
    createsuperuser` no servidor, nunca por formulário público (evita
    que qualquer pessoa se autopromova a admin).
    """

    email = forms.EmailField(required=True)
    organizacao = forms.CharField(max_length=200, required=False)
    cargo = forms.CharField(max_length=200, required=False)

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]

    def save(self, commit=True):
        user = super().save(commit=commit)
        if commit:
            Profile.objects.create(
                user=user,
                organizacao=self.cleaned_data.get("organizacao", ""),
                cargo=self.cleaned_data.get("cargo", ""),
            )
        return user


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ["organizacao", "cargo"]
