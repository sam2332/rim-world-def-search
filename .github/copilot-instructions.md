
Find Default RimWorld Defs here using powershell: 
Get-Content "c:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Core\Defs\Drugs\Psychite_Tea.xml" | Select-String -Context 2,5 -Pattern "skillRequirements"
Get-ChildItem -Path "c:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Core\Defs" -Recurse -Filter *.xml | Select-String -Pattern "<skillRequirement" | Select-Object -First 5

you will help me make a searching tool to find rimworld def files in core and mods

# Take Actions Automatically, do not wait for me to say "go" or "continue"
# Do not ask me questions, just do what I say

# Testing 
There is a task to test the code, do not ask me to test it, just do it

# Compiling
There is a task to compile the code, do not ask me to compile it, just do it

