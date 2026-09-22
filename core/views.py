from django.contrib.auth.decorators import login_required
from django.contrib.auth import login as auth_login
from django.shortcuts import redirect, render

from core.forms import ProfileForm, SignUpForm
from core.models import Profile


def signup(request):
    """Cadastro público — sempre cria usuário comum (is_staff=False)."""
    if request.user.is_authenticated:
        return redirect("core:profile")

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            auth_login(request, user)
            return redirect("core:profile")
    else:
        form = SignUpForm()

    return render(request, "core/signup.html", {"form": form})


@login_required
def profile(request):
    """
    Perfil do usuário logado. Se for staff/admin, mostra também o link
    para o Django Admin (/admin/) e para as ferramentas restritas a
    staff (upload de arquivos pesados NetCDF/GRIB).
    """
    perfil_obj, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "POST":
        form = ProfileForm(request.POST, instance=perfil_obj)
        if form.is_valid():
            form.save()
    else:
        form = ProfileForm(instance=perfil_obj)

    return render(request, "core/profile.html", {"form": form, "perfil": perfil_obj})
