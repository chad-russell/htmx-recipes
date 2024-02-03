// TODO:
//
// checkboxes for ingredients/steps w/ styling
// support fractions (?)
//

import { Glob } from 'bun';
import { Recipe, type Ingredient, type Step, type Timer, type Cookware, type Text } from '@cooklang/cooklang-ts';

function ingredient(ingredient: Ingredient): string {
    return `
        <li class='select-none ml-6 mt-2 flex flex-row items-center'>
            <input type='checkbox' class="h-6 w-6 rounded-md shadow" />
            <div class='flex flex-row ml-1'
                x-data='{ quantity: "${ingredient.quantity}", originalQuantity: "${ingredient.quantity}" }'
                x-on:mousedown='
                    if (!quantity) { return; }
                    let start = event.clientX;
                    let startQuantity = scaleQuantity(quantity, scale);
                    const mousemove = (event) => {
                        if (isNaN(Number(quantity))) {
                            return;
                        }
                        let diff = (event.clientX - start) * 0.1;
                        let newQuantity = Number(startQuantity) + diff;
                        newQuantity = Math.max(newQuantity, 0.1 * startQuantity);
                        scale = newQuantity / Number(originalQuantity);
                    };
                    const mouseup = () => {
                        window.removeEventListener("mousemove", mousemove);
                        window.removeEventListener("mouseup", mouseup);
                    };
                    window.addEventListener("mousemove", mousemove);
                    window.addEventListener("mouseup", mouseup);
                '
            >
                <span class='ml-1'>${ingredient.name}:</span>
                <span x-text="scaleQuantity(quantity, scale)" class='ml-1 text-slate-400 italic'></span>
                <span class='ml-1 text-slate-400 italic'>${ingredient.units}</span>
            </div>
        </li>
    `;
}

function ingredients(recipe: Recipe): string {
    return `
        <h4 class='text-3xl ml-6 mt-10'>Ingredients</h4>
        <ul>
            ${recipe.ingredients.map((i) => ingredient(i)).join('\n')}
        </ul>
    `;
}

function stepPart(sp: Ingredient | Cookware | Timer | Text): string {
    if (sp.type === 'ingredient') {
        return `
            <div 
                class='has-tooltip bg-orange-100 bg-opacity-20 px-1 rounded-md text-orange-300 text-nowrap'
                x-data='{ quantity: "${sp.quantity}" }'
            >
                ${sp.name}
                <span class='tooltip rounded shadow-lg p-1 text-red-600'>
                    <span x-text='scaleQuantity(quantity, scale)'></span>
                    <span>${sp.units}</span>
                </span>
            </div>
        `;
    } else if (sp.type === 'cookware') {
        return `
            <span class='text-blue-300 text-nowrap'>
                ${sp.name}
            </span>
        `;
    } else if (sp.type === 'timer') {
        return `
            <span class='text-green-800 text-nowrap'>
                ${sp.name}
            </span>
        `;
    } else if (sp.type === 'text') {
        return `
            <div class='${sp.value.endsWith(' ') ? 'pr-1' : ''} ${sp.value.startsWith(' ') ? 'pl-1' : ''} text-nowrap'>
                ${sp.value}
            </div>
        `;
    } else {
        return '';
    }
}

function step(s: Step): string {
    return `
        <div class='bg-gray-800 rounded-lg shadow-lg px-4 py-6 my-5 mx-4 flex flex-row'>
            <input type='checkbox' class='h-6 w-6 mr-3 rounded-md shadow' />
            <li class='flex flex-row flex-wrap'>${s.map(sp => stepPart(sp)).join('')}</li>
        </div>
    `;
}

function method(recipe: Recipe): string {
    return `
        <h4 class='text-3xl ml-6 mt-10'>Method</h4>
        <ol>
            ${recipe.steps.map((s) => step(s)).join('')}
        </ol>
    `;
}

Bun.serve({
    port: 3000,
    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/') {
            const glob = new Glob('*');

            const asyncFiles = [...glob.scanSync('./recipes')]
                .filter((file) => {
                    return file.endsWith('.cook');
                })
                .map(async (fileName) => {
                    const stripped = fileName.replace('.cook', '');
                    const file = await Bun.file('./recipes/' + fileName).text();
                    const lines = file.split('\n');
                    const titleLine = lines.find((line) => line.startsWith('>> title:'))!;
                    const title = titleLine.replace('>> title:', '').trim();
                    return `
                        <a href='/recipes/${stripped}'>${title}</a>
                    `;
                });

            const files = (await Promise.all(asyncFiles)).join('\n');

            return new Response(`
            <html>
                <head>
                    <title>Recipes</title>
                    <link rel='stylesheet' href='/static/css/style.css'>
                    <script src='//unpkg.com/alpinejs' defer></script>
                </head>
                <h3>Recipes:</h3>
                <div class='flex flex-col'>
                    ${files}
                </div>
            </html>
            `, {
                headers: {
                    'Content-Type': 'text/html',
                }
            });
        } else if (url.pathname.startsWith('/recipes/')) {
            const recipeName = url.pathname.replace('/recipes/', '');
            const recipeText = await Bun.file(`./recipes/${recipeName}.cook`).text();
            const recipe = new Recipe(recipeText);
            console.log(recipe);
            const lines = recipeText.split('\n');
            const titleLine = lines.find((line) => line.startsWith('>> title:'))!;
            const title = titleLine.replace('>> title:', '').trim();
            return new Response(
                `
                <html>
                <head>
                    <title>Recipes</title>
                    <link rel='stylesheet' href='/static/css/style.css'>
                    <script src='//unpkg.com/alpinejs' defer></script>
                </head>
                <body class='bg-black text-slate-100' x-data='{ scale: 1.0 }'>
                    <h3 class='text-5xl ml-6 mt-10'>${title}</h3>
                    ${ingredients(recipe)}
                    ${method(recipe)}
                    <script>
                        window.scaleQuantity = function(q, s) {
                            if (isNaN(Number(q))) {
                                return q;
                            }
                            const fixed = (Number(q) * s).toFixed(1);
                            if (fixed.endsWith('.0')) {
                                return fixed.slice(0, -2);
                            }
                            return fixed;
                        }
                    </script>
                </body>
                </html>
                `,
                {
                    headers: {
                        'Content-Type': 'text/html',
                    }
                });
        } else if (url.pathname.startsWith('/static/')) {
            return new Response(Bun.file('.' + url.pathname));
        } else {
            return new Response('Not found', {
                status: 404,
                statusText: 'Not Found',
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
        }
    }
});
