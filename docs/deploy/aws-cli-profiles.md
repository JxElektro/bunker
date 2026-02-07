# AWS CLI: perfiles (evitar usar la cuenta equivocada)

Si tienes varias cuentas (por ejemplo, **Akademi org** y **personal**), lo más seguro es operar con perfiles.

## Ver qué cuenta está activa ahora
```bash
aws sts get-caller-identity
aws configure list
```

## Listar perfiles disponibles
```bash
aws configure list-profiles
```

## Usar un perfil explícito (recomendado)
Temporal (solo para esa terminal):
```bash
export AWS_PROFILE=personal
aws sts get-caller-identity
```

En un comando:
```bash
aws --profile personal sts get-caller-identity
```

## Crear perfil personal (si no existe)
```bash
aws configure --profile personal
aws --profile personal sts get-caller-identity
```

## Regla práctica para este repo
- Para todo lo de deploy, ejecuta con `AWS_PROFILE=personal`.
- Si el output de `sts get-caller-identity` no es el esperado, **no sigas**.

