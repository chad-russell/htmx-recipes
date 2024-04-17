import { Glob } from 'bun';
import { Recipe, type Ingredient, type Step, type Timer, type Cookware, type Text } from './cooklang';

function stepPart(sp: Ingredient | Cookware | Timer | Text): string {
    const isFraction = sp.type == 'ingredient' && sp.quantityIsFraction;

    if (sp.type === 'ingredient') {
        return `
            <div 
                class='has-tooltip bg-orange-300 bg-opacity-20 px-1 rounded-md text-orange-700 text-nowrap'
                x-data='{ quantity: "${sp.quantity}" }'
            >
                ${sp.name}
                <span class='tooltip rounded shadow-lg p-1 text-red-600'>
                    <span x-text='numberToFractionString(scaleQuantity(quantity, scale), ${isFraction})'></span>
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

function step(s: Step, i: number): string {
    return `
        <div class='rcp-step bg-gray-200 rounded-lg shadow-lg px-4 py-6 my-5 mx-4 flex flex-row'>
            <input type='checkbox' class='h-6 w-6 mr-3 rounded-md shadow' x-on:click='toggleStepComplete(${i})' />
            <li class='flex flex-row flex-wrap'>${s.map(sp => stepPart(sp)).join('')}</li>
        </div>
    `;
}

function method(recipe: Recipe): string {
    return `
        <h4 class='text-3xl ml-6 mt-10'>Method</h4>
        <ol>
            ${recipe.steps.map((s, i) => step(s, i)).join('')}
        </ol>
    `;
}

function ingredients(): string {
    return `
        <ul>
            <template x-for='ingredient in allIngredients()'>
                <li class='rcp-ingredient select-none ml-6 mt-2 flex flex-row items-center'>
                    <input type='checkbox' class="h-6 w-6 rounded-md shadow" x-bind:checked='ingredient.complete' />
                    <div class='flex flex-row ml-1'
                        x-data='{ quantity: ingredient.quantity, originalQuantity: ingredient.quantity, isFraction: ingredient.quantityIsFraction }'
                        x-on:mousedown='
                        if (!quantity) { return; }
                        let start = event.clientX;
                        let startQuantity = scaleQuantity(quantity, scale, true);
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
                        <span class='ml-1' x-text='ingredient.name + ":"'></span>
                        <span x-text="numberToFractionString(scaleQuantity(quantity, scale), isFraction)" class='ml-1 text-slate-500 italic'></span>
                        <span class='ml-1 text-slate-500 italic' x-text='ingredient.units'></span>
                    </div>
                </li>
            </template>
        </ul>
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
                        <a class='text-center text-2xl mb-3' href='/recipes/${stripped}'>${title}</a>
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
                <body>
                    <h3 class='text-5xl w-full text-center mb-10'>Recipes</h3>
                    <div class='flex flex-col'>
                        ${files}
                    </div>
                </body>
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
                <body class='text-slate-800' x-data='recipe'>
                    <h3 class='text-5xl ml-6 mt-10'>${title}</h3>
                    <h4 class='text-3xl ml-6 mt-10'>Ingredients</h4>

                    ${ingredients()}

                    ${method(recipe)}

                    <script>
                        window.scaleQuantity = function(q, s, r) {
                            if (isNaN(Number(q))) {
                                return q;
                            }

                            if (r) {
                                const fixed = (Number(q) * s).toFixed(1);
                                if (fixed.endsWith('.0')) {
                                    return fixed.slice(0, -2);
                                }
                                return fixed;
                            }

                            return Number(q) * s;
                        }

                        const acceptableDenominators = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                        const maxDistanceToNumerator = 0.01;

                        function roundFixed(f) {
                            if (typeof(f) != 'number') {
                                return;
                            }

                            const fixed = Number(f).toFixed(1);
                            if (fixed.endsWith('.0')) {
                                return fixed.slice(0, -2);
                            }
                            return fixed;
                        }

                        function numberToFractionString(n, isFraction) {
                            if (!isFraction) {
                                return roundFixed(n);
                            }

                            const negative = (n < 0);
                            if (negative) n = -n;

                            const wholePart = Math.floor(n);
                            n -= wholePart;

                            const denom = acceptableDenominators.find(d =>
                                Math.abs(d * n - Math.round(d * n)) <= maxDistanceToNumerator
                            );
                            if (typeof denom === 'undefined') {
                                return roundFixed(n + wholePart)
                            }
                            const numer = Math.round(denom * n);

                            if (denom === 1) {
                                return "" + (wholePart + numer) * (negative ? -1 : 1);
                            }

                            return (negative ? "-" : "") +
                                (wholePart ? wholePart + " " : "") +
                                numer + "/" + denom;

                        }

                        document.addEventListener('alpine:init', () => {
                            Alpine.data('recipe', () => {
                                return ({
                                    scale: 1.0,
                                    completedSteps: new Set(),
                                    ...${JSON.stringify(recipe)},

                                    allIngredients() {
                                        return this.steps.reduce((acc, step) => {
                                            for (const sp of step) {
                                                if (sp.type === 'ingredient') {
                                                    acc.push({
                                                        ...sp,
                                                        'complete': this.completedSteps.has(this.steps.indexOf(step)),
                                                    });
                                                }
                                            }
                                            return acc;
                                        }, []);
                                    },

                                    toggleStepComplete(i) {
                                        if (this.completedSteps.has(i)) {
                                            this.completedSteps.delete(i);
                                        } else {
                                            this.completedSteps.add(i);
                                        }
                                    }
                                });
                            });
                        });
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

