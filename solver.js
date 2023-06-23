class ConstraintSystem {
    // base class, you'll need to extend it with FIELDS, DEFAULTS and CONSTRAINTS

    static FLOAT_DIFF_LIMIT = 1e-6; // within 1 ppm we consider numbers to be equal

    static HANDLER = {
        // proxy handler to throw error if we want to assign a different value to a property
        set(obj, prop, new_value) {
            if (!isNaN(new_value)) {
                if (isNaN(obj[prop])) {
                    obj[prop] = new_value;
                }
                else {
                    let diff = Math.abs(new_value - obj[prop]);
                    if (this.value !== 0) {
                        diff /= Math.abs(obj[prop]);
                    }
                    if (diff > ConstraintSystem.FLOAT_DIFF_LIMIT) {
                        throw new Error(`Param inconsistency: old ${obj[prop]} != new ${new_value}`);
                    }
                }
            }
            return true;
        },
    };

    static solve(input) {
        const obj = Object.assign(Object.fromEntries(this.FIELDS.map(f => [f, NaN])), input);
        const pobj = new Proxy(obj, ConstraintSystem.HANDLER);
        const cs = [ ...this.CONSTRAINTS ];
        let prev_NaNs = -1;
        
        const solve_pass = () => {
            while (true) {
                /*console.log("----------------");
                for (let f in obj) {
                    console.log(`field=${f}, value=${obj[f]}`);
                }
                cs.forEach(c => console.log(`   c=${c}`)); */

                const num_NaNs = Object.values(obj).filter(isNaN).length;
                if (num_NaNs === 0) {
                    return true; // solved
                }
                if (num_NaNs === prev_NaNs) {
                    return false; // can't make it better and it's still underspecified
                }
                prev_NaNs = num_NaNs;
                
                // try to apply the constraints
                cs.forEach((inv, idx) => {
                    const res = inv(pobj);
                    if (!isNaN(res)) {
                        // console.log(`Applied ${inv}`);
                        delete cs[idx];
                    }
                });
            }
        }

        // try to solve it without using defaults
        if (solve_pass()) {
            return obj;
        }
        // try to solve it by applying the defaults one by one
        for (const [k, v] of Object.entries(this.DEFAULTS)) {
            // apply the default if the value is missing, and try to solve it again, now with the defaults
            if (isNaN(obj[k])) {
                obj[k] = v;
                // console.log(`Applying default to .${k}`);
                if (solve_pass()) {
                    return obj;
                }
            }
        }
        // still underspecified, nothing more to do
        return false;
    }
}


class InvoiceItemConstraintSystem extends ConstraintSystem {
    static FIELDS = [ "qty", "rate", "net_amount", "vat_pct", "vat", "gross_amount" ];
    static DEFAULTS = {
        vat_pct: 5,
        qty: 1,
    }
    static CONSTRAINTS = [
        // net_amount = qty * rate
        obj => obj.net_amount = obj.qty * obj.rate,
        obj => obj.qty = obj.net_amount / obj.rate,
        obj => obj.rate = obj.net_amount / obj.qty,

        // vat = net_amount * vat_pct / 100
        obj => obj.vat = obj.net_amount * obj.vat_pct / 100,
        obj => obj.net_amount = obj.vat * 100 / obj.vat_pct,
        obj => obj.vat_pct = obj.vat * 100 / obj.net_amount,

        // gross_amount = net_amount + vat
        obj => obj.gross_amount = obj.net_amount + obj.vat,
        obj => obj.net_amount = obj.gross_amount - obj.vat,
        obj => obj.vat = obj.gross_amount - obj.net_amount,

        // gross_amount = net_amount * (1 + (vat_pct/100))
        obj => obj.gross_amount = obj.net_amount * (1 + (obj.vat_pct / 100)),
        obj => obj.net_amount = obj.gross_amount / (1 + (obj.vat_pct / 100)),
        obj => obj.vat_pct = (obj.gross_amount / obj.net_amount - 1) * 100,
    ];
}


// test a consistent case by trying to solve every subset of the fields
const consistent = { qty: 2, rate: 50, net_amount: 100, vat_pct: 5, vat: 5,gross_amount: 105 };
console.log(`the real case: ${JSON.stringify(consistent)}`);

const NUM_FIELDS = InvoiceItemConstraintSystem.FIELDS.length;
for (let testcase_idx = 0; testcase_idx < (1 << NUM_FIELDS); testcase_idx++) {
    const subset = {};
    for (let i = 0; i < NUM_FIELDS; i++) {
        if (testcase_idx & (1 << i)) {
            const field = InvoiceItemConstraintSystem.FIELDS[i];
            subset[field] = consistent[field];
        }
    }
    try {
        let result = InvoiceItemConstraintSystem.solve(subset);
        console.log(`${testcase_idx}: ${JSON.stringify(subset)} -> ${JSON.stringify(result)}`);
    }
    catch (err) {
        console.log(`${testcase_idx}: ${JSON.stringify(subset)} -> ERROR: ${err}`);
    }
}
